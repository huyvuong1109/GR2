# -*- coding: utf-8 -*-
"""
ingest.py - Pipeline trich xuat BCTC.

Flow:
  ticker_type.json
    -> PDF -> DoclingOCR (Hybrid)
    -> MetadataExtractor (ten CT, don vi, quy/nam)
    -> FinancialTablesExtractor x3 song song (BS/PL/CF)
    -> AggregatedParser (Pydantic, gia tri da ve VND)
    -> ghi master_raw.json  (luu tru vinh vien, khong can OCR lai)
    -> map canonical slug theo loai CT
    -> ghi analytics.db (financials_corporate/bank/securities/insurance)
    -> bank integrity checks

Re-map khong can OCR lai:
    from ingest import remap_analytics
    remap_analytics()
"""

import gc
import glob
import json
import os
import re
import sys
import threading
import unicodedata

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from logger import get_logger
from ocr import get_ocr_service
from services.pipeline import create_pipeline
from canonical_map import map_to_canonical
from Database.models_new import (
    AnalyticsCompany, ANALYTICS_TABLE_MAP,
    make_analytics_engine, make_session,
    run_bank_integrity_checks,
)

logger = get_logger(__name__)

# ==============================================================================
# CAU HINH
# ==============================================================================


# Tu dong detect tat ca dataset co chua PDF
# Ho tro ca format cu (bctc-DIG) va format moi (bctc-group-21)
_BASE = "/kaggle/input/datasets/huyvuong11"

INPUT_DIRS = []
for dataset_dir in glob.glob(f"{_BASE}/bctc-*"):
    # Moi subfolder trong dataset = 1 cong ty
    for subdir in glob.glob(f"{dataset_dir}/*/"):
        if os.path.isdir(subdir):
            INPUT_DIRS.append(subdir)

# Fallback: neu khong tim thay subfolder, thu dung truc tiep
if not INPUT_DIRS:
    INPUT_DIRS = glob.glob(f"{_BASE}/bctc-*")
MD_CACHE_DIR      = "/kaggle/working/ocr_md_cache"
RAW_JSON_PATH     = "/kaggle/working/master_raw.json"
ANALYTICS_DB_PATH = "/kaggle/working/analytics.db"
TICKER_TYPE_PATH  = os.path.join(os.path.dirname(__file__), "..", "ticker_type.json")

os.makedirs(MD_CACHE_DIR, exist_ok=True)

# ==============================================================================
# HELPERS
# ==============================================================================

QUARTER_MAP = {
    "1": 1, "2": 2, "3": 3, "4": 4,
    "mot": 1, "hai": 2, "ba": 3, "bon": 4,
    "i": 1, "ii": 2, "iii": 3, "iv": 4,
}


def _norm(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text or "")
    t = "".join(c for c in nfkd if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-zA-Z0-9\s]", " ", t).lower()
    return re.sub(r"\s+", " ", t).strip()


def parse_ticker(dir_path: str) -> str:
    """Lay ticker tu ten subfolder cuoi cung."""
    return os.path.basename(dir_path.rstrip("/\\")).upper()

def parse_quarter_year(filename: str) -> tuple[int | None, int | None]:
    low = _norm(filename)
    q = None
    mq = re.search(r"quy\s*(\w+)", low)
    if mq:
        q = QUARTER_MAP.get(mq.group(1))
    y = None
    my = re.search(r"nam\s*(20\d{2})", low)
    if my:
        y = int(my.group(1))
    else:
        m2 = re.search(r"(20\d{2})", low)
        if m2:
            y = int(m2.group(1))
    return q, y


def load_ticker_type_map(json_path: str) -> dict[str, str]:
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        logger.warning(f"Khong tim thay {json_path}, mac dinh tat ca la 'corporate'")
        return {}
    mapping: dict[str, str] = {}
    for ctype in ("bank", "securities", "insurance"):
        for ticker in data.get(ctype, []):
            mapping[ticker.upper()] = ctype
    return mapping


def _cache_key(ticker: str, filename: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", f"{ticker}_{filename}")


def load_or_ocr(pdf_path: str, ticker: str, ocr_service) -> str | None:
    filename   = os.path.basename(pdf_path)
    cache_path = os.path.join(MD_CACHE_DIR, _cache_key(ticker, filename) + ".md")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8", errors="replace") as f:
            md = f.read().strip()
        if md:
            logger.info("  src: cache")
            return md
    logger.info("  src: ocr (Docling Hybrid)")
    try:
        md = ocr_service.process_pdf(pdf_path)
    except Exception as e:
        logger.error(f"  OCR failed: {e}")
        return None
    if md and md.strip():
        with open(cache_path, "w", encoding="utf-8", errors="ignore") as f:
            f.write(md)
        logger.info("  src: ocr -> cached")
    return md or None


# ==============================================================================
# RAW JSON - luu tru vinh vien
# ==============================================================================

_RAW_LOCK = threading.Lock()


def _load_raw_json(path: str) -> dict:
    """Doc master_raw.json, tra ve {} neu chua co."""
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_raw_json(path: str, data: dict):
    """Ghi atomic vao master_raw.json."""
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def upsert_raw_json(ticker: str, quarter: int, year: int,
                    company_type: str, company_name: str,
                    unit: str, is_ytd: bool,
                    pdf_filename: str, ocr_chars: int,
                    report) -> int:
    """
    Them/cap nhat 1 ky bao cao vao master_raw.json.
    Format: {"VCB": [{period1}, {period2}], "ACB": [...]}
    Tra ve so items da luu.
    """
    with _RAW_LOCK:
        data = _load_raw_json(RAW_JSON_PATH)

        if ticker not in data:
            data[ticker] = []

        # Xoa period cu neu trung quy/nam
        data[ticker] = [
            p for p in data[ticker]
            if not (p["quarter"] == quarter and p["year"] == year)
        ]

        # Build items theo statement, giu nguyen ten goc
        items: dict[str, list] = {"CDKT": [], "KQKD": [], "LCTT": []}
        total = 0
        for stmt_name, stmt_obj in [
            ("CDKT", report.balance_sheet),
            ("KQKD", report.income_statement),
            ("LCTT", report.cash_flow),
        ]:
            for order, item in enumerate(stmt_obj.items):
                if item.value is None:
                    continue
                items[stmt_name].append({
                    "item_order": order,
                    "item_code":  getattr(item, "item_code",  None),
                    "item_name":  item.item_name,
                    "notes_ref":  getattr(item, "notes_ref",  None),
                    "value":      int(item.value),
                })
                total += 1

        data[ticker].append({
            "ticker":       ticker,
            "quarter":      quarter,
            "year":         year,
            "company_type": company_type,
            "company_name": company_name,
            "unit":         unit,
            "is_ytd":       is_ytd,
            "pdf_filename": pdf_filename,
            "ocr_chars":    ocr_chars,
            "items":        items,
        })

        # Sort theo nam/quy
        data[ticker].sort(key=lambda p: (p["year"], p["quarter"]))
        _save_raw_json(RAW_JSON_PATH, data)

    return total


# ==============================================================================
# ANALYTICS DB
# ==============================================================================

def upsert_analytics(analytics_session, ticker: str, company_name: str,
                     company_type: str, quarter: int, year: int, report) -> int:
    # Upsert company
    co = analytics_session.query(AnalyticsCompany).filter_by(ticker=ticker).first()
    if co is None:
        co = AnalyticsCompany(ticker=ticker, name=company_name or ticker,
                              company_type=company_type)
        analytics_session.add(co)
        analytics_session.flush()
    elif company_name and company_name != ticker:
        co.name = company_name

    # Chon model va slug list theo loai CT
    ctype = company_type if company_type in ANALYTICS_TABLE_MAP else "corporate"
    Model, slug_list = ANALYTICS_TABLE_MAP[ctype]

    # Xoa row cu
    analytics_session.query(Model).filter_by(
        ticker=ticker, quarter=quarter, year=year
    ).delete(synchronize_session=False)

    # Gom slug -> value (uu tien gia tri tuyet doi lon hon)
    slug_data: dict[str, int] = {}
    for stmt in [report.balance_sheet, report.income_statement, report.cash_flow]:
        for item in stmt.items:
            if item.value is None:
                continue
            slug = map_to_canonical(item.item_name, company_type=ctype)
            if slug is None:
                orig = getattr(item, "original_name", None)
                if orig:
                    slug = map_to_canonical(orig, company_type=ctype)
            if slug is None or slug not in slug_list:
                continue
            if slug not in slug_data:
                slug_data[slug] = int(item.value)
    # Ghi row
    row = Model(ticker=ticker, quarter=quarter, year=year)
    for slug, val in slug_data.items():
        if hasattr(row, slug):
            setattr(row, slug, val)
    analytics_session.add(row)
    return len(slug_data)


# ==============================================================================
# BANK INTEGRITY CHECK
# ==============================================================================

def check_bank_integrity(ticker: str, quarter: int, year: int, report, company_type: str):
    if company_type != "bank":
        return
    slug_data: dict[str, float] = {}
    for stmt in [report.balance_sheet, report.income_statement, report.cash_flow]:
        for item in stmt.items:
            if item.value is None:
                continue
            slug = map_to_canonical(item.item_name, company_type="bank")
            if slug:
                slug_data[slug] = float(item.value)

    failures = run_bank_integrity_checks(slug_data)
    if failures:
        logger.warning(f"  [INTEGRITY] {ticker} Q{quarter}/{year} - {len(failures)} check(s) failed:")
        for f in failures:
            logger.warning(f"    {f['check']}: expected={f.get('expected')}, "
                           f"got={f.get('computed') or f.get('got')}, "
                           f"diff={f['diff_pct']}%")
    else:
        logger.info(f"  [INTEGRITY] {ticker} Q{quarter}/{year} - OK")


# ==============================================================================
# REMAP - tu raw.json -> analytics.db khong can OCR lai
# ==============================================================================

def remap_analytics(
    raw_json_path: str = RAW_JSON_PATH,
    analytics_db_path: str = ANALYTICS_DB_PATH,
):
    """
    Doc master_raw.json -> re-map canonical -> ghi lai analytics.db.
    Dung khi cai thien canonical_map ma khong can OCR lai.

    Cach dung:
        from ingest import remap_analytics
        remap_analytics()
    """
    from services.parser import ParsedReport, ParsedStatement, FinancialItem

    logger.info(f"Bat dau remap tu {raw_json_path} ...")
    data = _load_raw_json(raw_json_path)
    if not data:
        logger.error("master_raw.json rong hoac chua ton tai.")
        return

    analytics_engine = make_analytics_engine(analytics_db_path)
    AnalyticsSession = make_session(analytics_engine)

    total_slugs = 0
    total_periods = 0

    for ticker, periods in data.items():
        for period in periods:
            quarter      = period["quarter"]
            year         = period["year"]
            company_type = period["company_type"]
            company_name = period["company_name"]

            # Rebuild ParsedReport tu raw JSON
            def _build_stmt(raw_items: list) -> ParsedStatement:
                stmt = ParsedStatement()
                stmt.items = [
                    FinancialItem(
                        item_code = i.get("item_code"),
                        item_name = i["item_name"],
                        value     = i["value"],
                        notes_ref = i.get("notes_ref"),
                    )
                    for i in raw_items
                    if i.get("value") is not None
                ]
                return stmt

            report = ParsedReport(
                company_name = company_name,
                stock_ticker = ticker,
                year         = year,
                quarter      = quarter,
                unit         = period.get("unit", "VND"),
                is_ytd       = period.get("is_ytd", False),
            )
            report.balance_sheet    = _build_stmt(period["items"].get("CDKT", []))
            report.income_statement = _build_stmt(period["items"].get("KQKD", []))
            report.cash_flow        = _build_stmt(period["items"].get("LCTT", []))

            # Ghi analytics.db
            ana_sess = AnalyticsSession()
            try:
                n = upsert_analytics(ana_sess, ticker, company_name,
                                     company_type, quarter, year, report)
                ana_sess.commit()
                total_slugs += n
                total_periods += 1
                logger.info(f"  {ticker} Q{quarter}/{year}: +{n} slugs")
            except Exception as e:
                ana_sess.rollback()
                logger.error(f"  {ticker} Q{quarter}/{year} error: {e}")
            finally:
                AnalyticsSession.remove()

    logger.info("=" * 60)
    logger.info(f"REMAP XONG | {total_periods} ky | {total_slugs} slugs")
    logger.info(f"analytics.db: {analytics_db_path}")
    _preview_analytics(analytics_db_path)


# ==============================================================================
# MAIN RUN
# ==============================================================================

def run():
    if not INPUT_DIRS:
        logger.error("Khong tim thay INPUT_DIRS. Sua lai bien INPUT_DIRS trong ingest.py.")
        return

    ticker_type_map = load_ticker_type_map(TICKER_TYPE_PATH)
    logger.info(f"Ticker type map: {len(ticker_type_map)} ticker co loai dac thu")

    ocr      = get_ocr_service("hybrid")
    pipeline = create_pipeline(mode="separate", extract_notes=False, extract_metadata=True)

    analytics_engine = make_analytics_engine(ANALYTICS_DB_PATH)
    AnalyticsSession = make_session(analytics_engine)

    all_files: list[tuple[str, str]] = []
    for ticker_dir in INPUT_DIRS:
        ticker = parse_ticker(ticker_dir)
        for pdf in sorted(glob.glob(os.path.join(ticker_dir, "*.pdf"))):
            all_files.append((ticker, pdf))
    if not all_files:
        logger.error("Khong tim thay file PDF nao.")
        return

    logger.info(f"Tim thay {len(all_files)} file | {len(INPUT_DIRS)} cong ty\n")
    total_raw = total_ana = 0

    for i, (ticker, pdf_path) in enumerate(all_files, 1):
        fname         = os.path.basename(pdf_path)
        quarter, year = parse_quarter_year(fname)
        company_type  = ticker_type_map.get(ticker, "corporate")

        logger.info(
            f"[{i}/{len(all_files)}] {ticker} ({company_type})"
            + (f" Q{quarter}/{year}" if quarter and year else " Q?/?")
            + f" | {fname}"
        )

        # Buoc 1: OCR (co cache .md)
        md = load_or_ocr(pdf_path, ticker, ocr)
        if not md:
            logger.error("  OCR that bai\n")
            continue

        # Buoc 2: LLM extract + parse
        try:
            report = pipeline.process(md)
        except Exception as e:
            logger.error(f"  Pipeline that bai: {e}\n")
            continue

        # Buoc 3: fallback quarter/year tu metadata LLM
        if not quarter or not year:
            quarter = getattr(report, "quarter", None)
            year    = getattr(report, "year",    None)
        if not quarter or not year:
            logger.warning("  Bo qua: khong xac dinh duoc quy/nam\n")
            continue

        company_name = getattr(report, "company_name", None) or ticker
        logger.info(
            f"  {company_name} | "
            f"BS={len(report.balance_sheet.items)}, "
            f"PL={len(report.income_statement.items)}, "
            f"CF={len(report.cash_flow.items)} items"
        )

        # Buoc 4a: ghi master_raw.json (luu tru vinh vien)
        try:
            n = upsert_raw_json(
                ticker       = ticker,
                quarter      = quarter,
                year         = year,
                company_type = company_type,
                company_name = company_name,
                unit         = getattr(report, "unit", "VND") or "VND",
                is_ytd       = getattr(report, "is_ytd", False),
                pdf_filename = fname,
                ocr_chars    = len(md),
                report       = report,
            )
            total_raw += n
            logger.info(f"  master_raw.json: +{n} items")
        except Exception as e:
            logger.error(f"  master_raw.json error: {e}")

        # Buoc 4b: ghi analytics.db
        ana_sess = AnalyticsSession()
        try:
            n = upsert_analytics(ana_sess, ticker, company_name, company_type,
                                 quarter, year, report)
            ana_sess.commit()
            total_ana += n
            logger.info(f"  analytics.db: +{n} slugs")
        except Exception as e:
            ana_sess.rollback()
            logger.error(f"  analytics.db error: {e}")
        finally:
            AnalyticsSession.remove()

        # Buoc 5: bank integrity check
        check_bank_integrity(ticker, quarter, year, report, company_type)

        logger.info("")
        gc.collect()

    logger.info("=" * 60)
    logger.info(f"HOAN THANH | raw={total_raw} items | analytics={total_ana} slugs")
    logger.info(f"master_raw.json : {RAW_JSON_PATH}")
    logger.info(f"analytics.db    : {ANALYTICS_DB_PATH}")
    _preview_analytics(ANALYTICS_DB_PATH)


# ==============================================================================
# PREVIEW
# ==============================================================================

def _preview_analytics(db_path: str):
    import sqlite3
    try:
        conn   = sqlite3.connect(db_path)
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()]
        logger.info(f"\nanalytics.db ({db_path}):")
        for t in tables:
            cnt = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            logger.info(f"  {t}: {cnt} rows")
        conn.close()
    except Exception as e:
        logger.error(f"Preview analytics.db: {e}")


if __name__ == "__main__":
    run()