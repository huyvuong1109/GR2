# -*- coding: utf-8 -*-
"""
ingest.py - Pipeline trich xuat BCTC ghi dong thoi 2 DB.

raw.db      : giu nguyen cau truc bao cao (tung dong chi tieu)
analytics.db: wide table theo loai cong ty (corporate/bank/securities/insurance)

Flow:
  ticker_type.json
    -> PDF -> DoclingOCR (Hybrid)
    -> MetadataExtractor (ten CT, don vi, quy/nam)
    -> FinancialTablesExtractor x3 song song (BS/PL/CF)
    -> AggregatedParser (Pydantic, gia tri da ve VND)
    -> ghi raw.db  (report_periods + report_items)
    -> map canonical slug theo loai CT
    -> ghi analytics.db (financials_corporate/bank/securities/insurance)
    -> bank integrity checks
"""

import gc
import glob
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from logger import get_logger
from ocr import get_ocr_service
from services.pipeline import create_pipeline
from canonical_map import map_to_canonical
from Database.models_new import (
    RawCompany, RawReportPeriod, RawReportItem,
    make_raw_engine, make_session,
    AnalyticsCompany, ANALYTICS_TABLE_MAP,
    make_analytics_engine,
    run_bank_integrity_checks,
)

logger = get_logger(__name__)

# ==============================================================================
# CAU HINH
# ==============================================================================

INPUT_DIRS        = glob.glob("/kaggle/input/datasets/huyvuong11/bctc-*")
MD_CACHE_DIR      = "/kaggle/working/ocr_md_cache"
RAW_DB_PATH       = "/kaggle/working/raw.db"
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
    name = os.path.basename(dir_path)
    return name[5:].replace("-", "").upper() if name.lower().startswith("bctc-") \
        else name.replace("-", "").upper()


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
# GHI RAW DB
# ==============================================================================

UNIT_MULTIPLIER = {
    "VND": 1.0,
    "nghin VND": 1_000.0,
    "trieu VND": 1_000_000.0,
    "ty VND": 1_000_000_000.0,
}


def upsert_raw(raw_session, ticker, company_name, company_type,
               quarter, year, report, pdf_filename, md_len) -> int:
    # Upsert company
    company = raw_session.query(RawCompany).filter_by(ticker=ticker).first()
    if company is None:
        company = RawCompany(ticker=ticker, name=company_name or ticker,
                             company_type=company_type)
        raw_session.add(company)
        raw_session.flush()
    elif company_name and company_name != ticker:
        company.name = company_name

    # Xoa period cu
    report_kind = getattr(report, "report_kind", "consolidated")
    old = raw_session.query(RawReportPeriod).filter_by(
        company_id=company.id, quarter=quarter, year=year, report_kind=report_kind
    ).first()
    if old:
        raw_session.delete(old)
        raw_session.flush()

    # Tao period moi
    unit = getattr(report, "unit", "VND") or "VND"
    period = RawReportPeriod(
        company_id=company.id,
        quarter=quarter,
        year=year,
        report_kind=report_kind,
        unit=unit,
        unit_multiplier=UNIT_MULTIPLIER.get(unit, 1.0),
        is_ytd=1 if getattr(report, "is_ytd", False) else 0,
        pdf_filename=pdf_filename,
        ocr_chars=md_len,
    )
    raw_session.add(period)
    raw_session.flush()

    # Ghi tung item (giu nguyen ten goc, thu tu)
    saved = 0
    for stmt_name, stmt in [
        ("CDKT", report.balance_sheet),
        ("KQKD", report.income_statement),
        ("LCTT", report.cash_flow),
    ]:
        for order, item in enumerate(stmt.items):
            if item.value is None:
                continue
            slug = map_to_canonical(item.item_name, company_type=company_type)
            raw_session.add(RawReportItem(
                period_id=period.id,
                statement=stmt_name,
                item_order=order,
                item_code=getattr(item, "item_code", None),
                item_name=item.item_name,
                notes_ref=getattr(item, "notes_ref", None),
                value=int(item.value),
                slug=slug,
            ))
            saved += 1
    return saved


# ==============================================================================
# GHI ANALYTICS DB
# ==============================================================================

def upsert_analytics(analytics_session, ticker, company_name, company_type,
                     quarter, year, report) -> int:
    # Upsert company
    co = analytics_session.query(AnalyticsCompany).filter_by(ticker=ticker).first()
    if co is None:
        co = AnalyticsCompany(ticker=ticker, name=company_name or ticker,
                              company_type=company_type)
        analytics_session.add(co)
        analytics_session.flush()
    elif company_name and company_name != ticker:
        co.name = company_name

    # Chon model
    ctype = company_type if company_type in ANALYTICS_TABLE_MAP else "corporate"
    Model, slug_list = ANALYTICS_TABLE_MAP[ctype]

    # Xoa row cu
    analytics_session.query(Model).filter_by(
        ticker=ticker, quarter=quarter, year=year
    ).delete(synchronize_session=False)

    # Gom slug -> value
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
            existing = slug_data.get(slug)
            if existing is None or abs(item.value) > abs(existing):
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

def check_bank_integrity(ticker, quarter, year, report, company_type):
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
# MAIN
# ==============================================================================

def run():
    if not INPUT_DIRS:
        logger.error("Khong tim thay INPUT_DIRS. Sua lai bien INPUT_DIRS trong ingest.py.")
        return

    ticker_type_map = load_ticker_type_map(TICKER_TYPE_PATH)
    logger.info(f"Ticker type map: {len(ticker_type_map)} ticker co loai dac thu")

    ocr      = get_ocr_service("hybrid")
    pipeline = create_pipeline(mode="separate", extract_notes=False, extract_metadata=True)

    raw_engine       = make_raw_engine(RAW_DB_PATH)
    analytics_engine = make_analytics_engine(ANALYTICS_DB_PATH)
    RawSession       = make_session(raw_engine)
    AnalyticsSession = make_session(analytics_engine)

    all_files: list[tuple[str, str]] = []
    for d in INPUT_DIRS:
        ticker = parse_ticker(d)
        for pdf in sorted(glob.glob(os.path.join(d, "*.pdf"))):
            all_files.append((ticker, pdf))

    if not all_files:
        logger.error("Khong tim thay file PDF nao.")
        return

    logger.info(f"Tim thay {len(all_files)} file | {len(INPUT_DIRS)} cong ty\n")
    total_raw = total_ana = 0

    for i, (ticker, pdf_path) in enumerate(all_files, 1):
        fname        = os.path.basename(pdf_path)
        quarter, year = parse_quarter_year(fname)
        company_type = ticker_type_map.get(ticker, "corporate")

        logger.info(
            f"[{i}/{len(all_files)}] {ticker} ({company_type})"
            + (f" Q{quarter}/{year}" if quarter and year else " Q?/?")
            + f" | {fname}"
        )

        # Buoc 1: OCR
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

        # Buoc 3: fallback quarter/year tu metadata
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

        # Buoc 4a: ghi raw.db
        raw_sess = RawSession()
        try:
            n = upsert_raw(raw_sess, ticker, company_name, company_type,
                           quarter, year, report, fname, len(md))
            raw_sess.commit()
            total_raw += n
            logger.info(f"  raw.db: +{n} items")
        except Exception as e:
            raw_sess.rollback()
            logger.error(f"  raw.db error: {e}")
        finally:
            RawSession.remove()

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
    logger.info(f"raw.db      : {RAW_DB_PATH}")
    logger.info(f"analytics.db: {ANALYTICS_DB_PATH}")
    _preview()


def _preview():
    import sqlite3
    for label, path in [("raw.db", RAW_DB_PATH), ("analytics.db", ANALYTICS_DB_PATH)]:
        try:
            conn   = sqlite3.connect(path)
            tables = [r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()]
            logger.info(f"\n{label}:")
            for t in tables:
                cnt = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
                logger.info(f"  {t}: {cnt} rows")
            conn.close()
        except Exception as e:
            logger.error(f"Preview {label}: {e}")


if __name__ == "__main__":
    run()