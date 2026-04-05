# -*- coding: utf-8 -*-
"""
ingest.py - Pipeline trich xuat BCTC tu PDF vao SQLite DB.

Flow:
  PDF -> DoclingOCR (Hybrid Tesseract+Surya)
      -> FinancialTablesExtractor (LLM, chay song song)
      -> AggregatedParser (Pydantic structured output)
      -> map_to_canonical (slug chuan)
      -> upsert_period -> financial_data.db
"""

import gc
import glob
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(__file__))

from logger import get_logger
from ocr import get_ocr_service
from services.pipeline import create_pipeline

from sqlalchemy import Column, Float, Integer, String, UniqueConstraint, create_engine
from sqlalchemy.orm import declarative_base, scoped_session, sessionmaker

logger = get_logger(__name__)

# ==============================================================================
# CAU HINH
# ==============================================================================

# Kaggle: thay bang duong dan toi thu muc chua PDF cua ban
INPUT_DIRS   = glob.glob("/kaggle/input/datasets/huyvuong11/bctc-*")

# Thu muc cache markdown sau OCR (tranh OCR lai nhung file da xu ly)
MD_CACHE_DIR = "/kaggle/working/ocr_md_cache"

# Duong dan DB dau ra
DB_PATH      = "/kaggle/working/financial_data.db"

os.makedirs(MD_CACHE_DIR, exist_ok=True)


# ==============================================================================
# DATABASE - Wide table (moi chi tieu = 1 cot, moi ky = 1 row)
# ==============================================================================

Base = declarative_base()

# -- Canonical slugs theo thu tu --

CDKT_COLS = [
    "tien_va_tuong_duong_tien",
    "dau_tu_tai_chinh_ngan_han",
    "phai_thu_ngan_han_khach_hang",
    "phai_thu_ngan_han_khac",
    "hang_ton_kho",
    "tai_san_ngan_han_khac",
    "tong_tai_san_ngan_han",
    "phai_thu_dai_han",
    "tai_san_co_dinh_huu_hinh",
    "tai_san_co_dinh_vo_hinh",
    "bat_dong_san_dau_tu",
    "dau_tu_tai_chinh_dai_han",
    "tai_san_dai_han_khac",
    "tong_tai_san_dai_han",
    "tong_tai_san",
    "vay_ngan_han",
    "phai_tra_nguoi_ban_ngan_han",
    "nguoi_mua_tra_tien_truoc_ngan_han",
    "thue_va_cac_khoan_phai_nop",
    "phai_tra_ngan_han_khac",
    "tong_no_ngan_han",
    "vay_dai_han",
    "phai_tra_dai_han_khac",
    "tong_no_dai_han",
    "tong_no_phai_tra",
    "von_gop_cua_chu_so_huu",
    "thang_du_von_co_phan",
    "loi_nhuan_sau_thue_chua_phan_phoi",
    "tong_von_chu_so_huu",
    "tong_nguon_von",
]

KQKD_COLS = [
    "doanh_thu_ban_hang_va_ccdv",
    "cac_khoan_giam_tru_doanh_thu",
    "doanh_thu_thuan",
    "gia_von_hang_ban",
    "loi_nhuan_gop",
    "doanh_thu_hoat_dong_tai_chinh",
    "chi_phi_tai_chinh",
    "chi_phi_ban_hang",
    "chi_phi_quan_ly_dn",
    "loi_nhuan_thuan_hdkd",
    "thu_nhap_khac",
    "chi_phi_khac",
    "loi_nhuan_khac",
    "loi_nhuan_truoc_thue",
    "chi_phi_thue_tndn",
    "loi_nhuan_sau_thue",
    "loi_nhuan_sau_thue_cua_cd_ct",
    "loi_nhuan_cua_co_dong_ct_me",
    "eps_co_ban",
]

LCTT_COLS = [
    "lctt_truoc_thay_doi_von_luu_dong",
    "thay_doi_khoan_phai_thu",
    "thay_doi_hang_ton_kho",
    "thay_doi_khoan_phai_tra",
    "lctt_thuan_hdkd",
    "tien_mua_tai_san_co_dinh",
    "tien_thu_thanh_ly_tscdd",
    "tien_chi_dau_tu_gop_von",
    "tien_thu_dau_tu_gop_von",
    "lctt_thuan_hddt",
    "tien_thu_vay",
    "tien_tra_no_vay",
    "co_tuc_da_tra",
    "lctt_thuan_hdtc",
    "tien_dau_ky",
    "tien_cuoi_ky",
]

ALL_COLS = CDKT_COLS + KQKD_COLS + LCTT_COLS


def _make_financials_model():
    attrs = {
        "__tablename__": "financials",
        "id":            Column(Integer, primary_key=True),
        "ticker":        Column(String(10), nullable=False),
        "quarter":       Column(Integer,    nullable=False),
        "year":          Column(Integer,    nullable=False),
        "__table_args__": (
            UniqueConstraint("ticker", "quarter", "year", name="uq_period"),
        ),
    }
    for slug in ALL_COLS:
        attrs[slug] = Column(Float, default=None)
    return type("Financials", (Base,), attrs)


Financials = _make_financials_model()

engine  = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"timeout": 30, "check_same_thread": False},
)
Base.metadata.create_all(engine)
Session = scoped_session(sessionmaker(bind=engine))


def upsert_period(
    session,
    ticker: str,
    quarter: int,
    year: int,
    data: dict[str, dict[str, float]],
) -> int:
    rec = session.query(Financials).filter_by(
        ticker=ticker, quarter=quarter, year=year
    ).first()
    if rec is None:
        rec = Financials(ticker=ticker, quarter=quarter, year=year)
        session.add(rec)

    saved = 0
    for _rtype, slug_vals in data.items():
        for slug, val in slug_vals.items():
            if hasattr(rec, slug):
                setattr(rec, slug, float(val))
                saved += 1
    return saved


# ==============================================================================
# CANONICAL MAP - slug chuan -> keywords nhan dien
# ==============================================================================

CANONICAL_CDKT = {
    "tien_va_tuong_duong_tien": [
        "tien va cac khoan tuong duong tien", "tien mat", "tien gui",
        "cash and cash equivalents", "tien va tuong duong",
    ],
    "dau_tu_tai_chinh_ngan_han": [
        "dau tu tai chinh ngan han", "chung khoan kinh doanh",
        "short term investments",
    ],
    "phai_thu_ngan_han_khach_hang": [
        "phai thu ngan han cua khach hang", "phai thu khach hang",
        "accounts receivable", "phai thu ngan han khach",
    ],
    "phai_thu_ngan_han_khac":      ["phai thu ngan han khac", "other receivables"],
    "hang_ton_kho":                ["hang ton kho", "inventories", "ton kho"],
    "tai_san_ngan_han_khac":       ["tai san ngan han khac", "other current assets"],
    "tong_tai_san_ngan_han": [
        "tong tai san ngan han", "total current assets", "a tong cong",
    ],
    "phai_thu_dai_han":            ["phai thu dai han", "long term receivables"],
    "tai_san_co_dinh_huu_hinh": [
        "tai san co dinh huu hinh", "property plant equipment",
        "nguyen gia tai san co dinh",
    ],
    "tai_san_co_dinh_vo_hinh":     ["tai san co dinh vo hinh", "intangible assets"],
    "bat_dong_san_dau_tu":         ["bat dong san dau tu", "investment properties"],
    "dau_tu_tai_chinh_dai_han": [
        "dau tu tai chinh dai han", "long term investments",
        "dau tu vao cong ty con", "dau tu vao cong ty lien ket",
    ],
    "tai_san_dai_han_khac":        ["tai san dai han khac", "other non current assets"],
    "tong_tai_san_dai_han": [
        "tong tai san dai han", "total non current assets", "b tong cong",
    ],
    "tong_tai_san":                ["tong cong tai san", "tong tai san", "total assets"],
    "vay_ngan_han": [
        "vay va no thue tai chinh ngan han", "vay ngan han",
        "short term borrowings", "vay ngan han va dai han den han tra",
    ],
    "phai_tra_nguoi_ban_ngan_han": [
        "phai tra nguoi ban ngan han", "accounts payable", "phai tra nha cung cap",
    ],
    "nguoi_mua_tra_tien_truoc_ngan_han": [
        "nguoi mua tra tien truoc ngan han", "advance from customers",
    ],
    "thue_va_cac_khoan_phai_nop": [
        "thue va cac khoan phai nop nha nuoc", "taxes payable", "thue phai nop",
    ],
    "phai_tra_ngan_han_khac":      ["phai tra ngan han khac", "other current liabilities"],
    "tong_no_ngan_han":            ["tong no ngan han", "total current liabilities"],
    "vay_dai_han": [
        "vay va no thue tai chinh dai han", "vay dai han", "long term borrowings",
    ],
    "phai_tra_dai_han_khac":       ["phai tra dai han khac", "other non current liabilities"],
    "tong_no_dai_han":             ["tong no dai han", "total non current liabilities"],
    "tong_no_phai_tra": [
        "tong no phai tra", "total liabilities", "tong cong no phai tra",
    ],
    "von_gop_cua_chu_so_huu": [
        "von gop cua chu so huu", "von dieu le", "charter capital",
        "share capital", "co phan pho thong",
    ],
    "thang_du_von_co_phan":        ["thang du von co phan", "share premium"],
    "loi_nhuan_sau_thue_chua_phan_phoi": [
        "loi nhuan sau thue chua phan phoi", "retained earnings",
        "loi nhuan chua phan phoi",
    ],
    "tong_von_chu_so_huu": [
        "tong von chu so huu", "total equity", "von chu so huu",
        "total stockholders equity",
    ],
    "tong_nguon_von": [
        "tong nguon von", "tong cong nguon von", "total liabilities and equity",
    ],
}

CANONICAL_KQKD = {
    "doanh_thu_ban_hang_va_ccdv": [
        "doanh thu ban hang va cung cap dich vu", "revenue",
        "doanh thu thuan ve ban hang", "net revenue from sales",
    ],
    "cac_khoan_giam_tru_doanh_thu": [
        "cac khoan giam tru doanh thu", "deductions from revenue",
    ],
    "doanh_thu_thuan": [
        "doanh thu thuan", "net revenue", "net sales",
        "doanh thu thuan ve ban hang va cung cap dich vu",
    ],
    "gia_von_hang_ban": [
        "gia von hang ban", "cost of goods sold", "cost of sales",
        "gia von hang ban va dich vu",
    ],
    "loi_nhuan_gop": [
        "loi nhuan gop ve ban hang", "gross profit", "loi nhuan gop", "gross margin",
    ],
    "doanh_thu_hoat_dong_tai_chinh": [
        "doanh thu hoat dong tai chinh", "financial income", "thu nhap tai chinh",
    ],
    "chi_phi_tai_chinh":           ["chi phi tai chinh", "financial expenses", "chi phi lai vay"],
    "chi_phi_ban_hang":            ["chi phi ban hang", "selling expenses", "chi phi kinh doanh"],
    "chi_phi_quan_ly_dn": [
        "chi phi quan ly doanh nghiep", "general and administrative",
        "chi phi quan ly", "g&a expenses",
    ],
    "loi_nhuan_thuan_hdkd": [
        "loi nhuan thuan tu hoat dong kinh doanh", "operating profit",
        "loi nhuan tu hoat dong",
    ],
    "thu_nhap_khac":               ["thu nhap khac", "other income"],
    "chi_phi_khac":                ["chi phi khac", "other expenses"],
    "loi_nhuan_khac":              ["loi nhuan khac", "other profit"],
    "loi_nhuan_truoc_thue": [
        "tong loi nhuan ke toan truoc thue", "profit before tax",
        "loi nhuan truoc thue", "earnings before tax", "ebt",
    ],
    "chi_phi_thue_tndn": [
        "chi phi thue thu nhap doanh nghiep", "income tax expense",
        "thue thu nhap doanh nghiep",
    ],
    "loi_nhuan_sau_thue": [
        "loi nhuan sau thue thu nhap doanh nghiep", "profit after tax",
        "net profit", "loi nhuan sau thue", "net income",
    ],
    "loi_nhuan_sau_thue_cua_cd_ct": [
        "loi ich cua co dong khong kiem soat", "minority interest",
        "phan loi nhuan cua co dong thieu so",
    ],
    "loi_nhuan_cua_co_dong_ct_me": [
        "loi nhuan cua co dong cong ty me", "profit attributable to parent",
    ],
    "eps_co_ban":                  ["lai co ban tren co phieu", "basic eps", "lai suat co ban"],
}

CANONICAL_LCTT = {
    "lctt_truoc_thay_doi_von_luu_dong": [
        "luu chuyen tien thuan tu hoat dong kinh doanh truoc",
        "cash from operations before working capital",
    ],
    "thay_doi_khoan_phai_thu":     ["tang giam cac khoan phai thu", "change in receivables"],
    "thay_doi_hang_ton_kho":       ["tang giam hang ton kho", "change in inventories"],
    "thay_doi_khoan_phai_tra":     ["tang giam cac khoan phai tra", "change in payables"],
    "lctt_thuan_hdkd": [
        "luu chuyen tien thuan tu hoat dong kinh doanh",
        "net cash from operating activities", "hoat dong kinh doanh thuan",
    ],
    "tien_mua_tai_san_co_dinh": [
        "tien chi de mua sam tai san co dinh", "purchase of fixed assets",
        "mua sam tai san",
    ],
    "tien_thu_thanh_ly_tscdd": [
        "tien thu tu thanh ly nhuong ban tai san co dinh",
        "proceeds from disposal of assets",
    ],
    "tien_chi_dau_tu_gop_von": [
        "tien chi dau tu gop von vao don vi khac", "investment in subsidiaries",
    ],
    "tien_thu_dau_tu_gop_von": [
        "tien thu hoi dau tu gop von vao don vi khac", "proceeds from investments",
    ],
    "lctt_thuan_hddt": [
        "luu chuyen tien thuan tu hoat dong dau tu",
        "net cash from investing activities", "hoat dong dau tu thuan",
    ],
    "tien_thu_vay":                ["tien thu tu di vay", "proceeds from borrowings", "vay nhan duoc"],
    "tien_tra_no_vay":             ["tien tra no goc vay", "repayment of borrowings", "tra no goc"],
    "co_tuc_da_tra":               ["co tuc loi nhuan da tra cho chu so huu", "dividends paid"],
    "lctt_thuan_hdtc": [
        "luu chuyen tien thuan tu hoat dong tai chinh",
        "net cash from financing activities", "hoat dong tai chinh thuan",
    ],
    "tien_dau_ky": [
        "tien va tuong duong tien dau ky", "cash at beginning", "so du tien dau ky",
    ],
    "tien_cuoi_ky": [
        "tien va tuong duong tien cuoi ky", "cash at end", "so du tien cuoi ky",
    ],
}

ALL_CANONICAL = {
    "CDKT": CANONICAL_CDKT,
    "KQKD": CANONICAL_KQKD,
    "LCTT": CANONICAL_LCTT,
}

# Build lookup index
_KEYWORD_INDEX: dict[str, tuple[str, str]] = {}
for _rtype, _schema in ALL_CANONICAL.items():
    for _slug, _keywords in _schema.items():
        for _kw in _keywords:
            # norm nhe: bo dau, thuong hoa, chuan hoa khoang trang
            _n = unicodedata.normalize("NFKD", _kw)
            _n = "".join(c for c in _n if unicodedata.category(c) != "Mn")
            _n = re.sub(r"[^a-zA-Z0-9\s]", " ", _n).lower()
            _n = re.sub(r"\s+", " ", _n).strip()
            _KEYWORD_INDEX[_n] = (_rtype, _slug)


def _norm(text: str) -> str:
    """Chuan hoa text: bo dau, thuong, chuan hoa khoang trang."""
    nfkd = unicodedata.normalize("NFKD", text or "")
    t = "".join(c for c in nfkd if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-zA-Z0-9\s]", " ", t).lower()
    return re.sub(r"\s+", " ", t).strip()


def map_to_canonical(item_name: str) -> tuple[str, str] | None:
    """
    Tim slug canonical cho ten chi tieu OCR.
    Thu tu uu tien: exact match -> substring -> reverse substring.
    """
    n = _norm(item_name)
    if not n:
        return None
    # 1. Exact match
    if n in _KEYWORD_INDEX:
        return _KEYWORD_INDEX[n]
    # 2. item_name chua keyword
    for kw, mapping in _KEYWORD_INDEX.items():
        if kw in n:
            return mapping
    # 3. Keyword chua item_name (OCR bi cat ngan)
    if len(n) >= 12:
        for kw, mapping in _KEYWORD_INDEX.items():
            if n in kw:
                return mapping
    return None


# ==============================================================================
# HELPER - parse ticker va quarter/year tu ten file/folder
# ==============================================================================

QUARTER_MAP = {
    "1": 1, "2": 2, "3": 3, "4": 4,
    "mot": 1, "hai": 2, "ba": 3, "bon": 4,
    "i": 1, "ii": 2, "iii": 3, "iv": 4,
}


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


# ==============================================================================
# BRIDGE - ParsedReport -> data dict cho upsert_period
# ==============================================================================

def build_data_from_report(report) -> dict[str, dict[str, float]]:
    """
    Chuyen ParsedReport (tu AggregatedParser) sang
    {"CDKT": {slug: val}, "KQKD": {...}, "LCTT": {...}}
    de truyen vao upsert_period().

    Luu y: AggregatedParser da chuyen tat ca ve VND,
    nen khong can nhan them scale.
    """
    data: dict[str, dict[str, float]] = {"CDKT": {}, "KQKD": {}, "LCTT": {}}

    stmt_map = {
        "balance_sheet":    report.balance_sheet,
        "income_statement": report.income_statement,
        "cash_flow":        report.cash_flow,
    }

    for _key, stmt in stmt_map.items():
        for item in stmt.items:
            if item.value is None:
                continue

            # Thu map tu item_name truoc
            mapping = map_to_canonical(item.item_name)

            # Fallback sang original_name neu co
            if mapping is None and getattr(item, "original_name", None):
                mapping = map_to_canonical(item.original_name)

            if mapping is None:
                continue

            rtype, slug = mapping
            existing = data[rtype].get(slug)
            # Giu gia tri co gia tri tuyet doi lon hon (tranh overwrite bang 0)
            if existing is None or abs(item.value) > abs(existing):
                data[rtype][slug] = float(item.value)

    return data


# ==============================================================================
# OCR CACHE - tranh OCR lai nhung file da xu ly
# ==============================================================================

def _cache_key(ticker: str, filename: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", f"{ticker}_{filename}")


def load_or_ocr(pdf_path: str, ticker: str, ocr_service) -> str | None:
    filename   = os.path.basename(pdf_path)
    cache_path = os.path.join(MD_CACHE_DIR, _cache_key(ticker, filename) + ".md")

    # Doc tu cache neu da co
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8", errors="replace") as f:
            md = f.read().strip()
        if md:
            logger.info("  src: cache")
            return md

    # Chay OCR moi
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
# MAIN
# ==============================================================================

def run():
    if not INPUT_DIRS:
        logger.error(
            "Khong tim thay thu muc input: /kaggle/input/datasets/huyvuong11/bctc-*\n"
            "Hay sua bien INPUT_DIRS trong ingest.py cho dung duong dan."
        )
        return

    # Khoi tao OCR: Docling + HybridOCR (Tesseract + Surya confidence-gated)
    logger.info("Dang khoi tao OCR service (Docling + Hybrid)...")
    ocr = get_ocr_service("hybrid")

    # Khoi tao LLM pipeline: 3 extractor chay song song + metadata
    logger.info("Dang khoi tao LLM extraction pipeline...")
    pipeline = create_pipeline(
        mode="separate",       # BalanceSheet / PL / CashFlow chay song song
        extract_notes=False,   # Bo qua notes de tiet kiem thoi gian
        extract_metadata=True, # Tu nhan don vi, loai BC, YTD
    )

    # Thu thap danh sach file PDF
    all_files = []
    for d in INPUT_DIRS:
        ticker = parse_ticker(d)
        for pdf in sorted(glob.glob(os.path.join(d, "*.pdf"))):
            all_files.append((ticker, pdf))

    if not all_files:
        logger.error("Khong tim thay file PDF nao trong INPUT_DIRS.")
        return

    logger.info(f"Tim thay {len(all_files)} file PDF | {len(INPUT_DIRS)} cong ty\n")
    total_saved = 0

    for i, (ticker, pdf_path) in enumerate(all_files, 1):
        fname         = os.path.basename(pdf_path)
        quarter, year = parse_quarter_year(fname)

        prefix = f"[{i}/{len(all_files)}] {ticker}"
        if quarter and year:
            logger.info(f"{prefix} Q{quarter}/{year} | {fname}")
        else:
            logger.info(f"{prefix} Q?/? | {fname} (se thu lay tu metadata)")

        # Buoc 1: OCR (co cache, tranh xu ly lai)
        md = load_or_ocr(pdf_path, ticker, ocr)
        if not md:
            logger.error("  OCR that bai, bo qua file nay.\n")
            continue

        # Buoc 2: Extract + Parse bang LLM
        try:
            report = pipeline.process(md)
        except Exception as e:
            logger.error(f"  Pipeline that bai: {e}\n")
            continue

        # Buoc 3: Lay quarter/year tu metadata neu ten file khong parse duoc
        if not quarter or not year:
            quarter = getattr(report, "quarter", None)
            year    = getattr(report, "year",    None)

        if not quarter or not year:
            logger.warning("  Bo qua: khong xac dinh duoc quy/nam.\n")
            continue

        # Buoc 4: Map canonical slug + upsert vao DB
        data    = build_data_from_report(report)
        n_cdkt  = len(data["CDKT"])
        n_kqkd  = len(data["KQKD"])
        n_lctt  = len(data["LCTT"])

        logger.info(
            f"  canonical: CDKT={n_cdkt}/{len(CDKT_COLS)}, "
            f"KQKD={n_kqkd}/{len(KQKD_COLS)}, "
            f"LCTT={n_lctt}/{len(LCTT_COLS)}"
        )

        session = Session()
        try:
            # Xoa row cu neu ton tai (de upsert sach)
            session.query(Financials).filter_by(
                ticker=ticker, quarter=quarter, year=year
            ).delete(synchronize_session=False)

            saved = upsert_period(session, ticker, quarter, year, data)
            session.commit()
            total_saved += saved

            logger.info(
                f"  Saved {saved} chi tieu | "
                f"BS={report.bs_found}, PL={report.pl_found}, CF={report.cf_found}\n"
            )
        except Exception as e:
            session.rollback()
            logger.error(f"  DB error: {e}\n")
        finally:
            Session.remove()

        gc.collect()

    # Tong ket
    logger.info("=" * 60)
    logger.info(f"HOAN THANH - {total_saved} chi tieu tong cong")
    logger.info(f"DB: {DB_PATH}")
    _preview_db()


def _preview_db():
    """In tong ket nhanh tu DB."""
    import sqlite3
    try:
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute("SELECT COUNT(*) FROM financials").fetchone()[0]
        logger.info(f"\nDB stats: {rows} ky bao cao")

        for row in conn.execute(
            "SELECT ticker, quarter, year FROM financials ORDER BY ticker, year, quarter"
        ).fetchall():
            logger.info(f"  {row[0]} Q{row[1]}/{row[2]}")

        # Kiem tra do phu chi tieu quan trong
        check = [
            "doanh_thu_thuan",
            "loi_nhuan_sau_thue",
            "tong_tai_san",
            "tong_von_chu_so_huu",
            "lctt_thuan_hdkd",
        ]
        logger.info("\nDo phu chi tieu quan trong:")
        for col in check:
            cnt = conn.execute(
                f"SELECT COUNT(*) FROM financials WHERE {col} IS NOT NULL"
            ).fetchone()[0]
            logger.info(f"  {col:<40}: {cnt}/{rows} ky")

        conn.close()
    except Exception as e:
        logger.error(f"Preview DB loi: {e}")


if __name__ == "__main__":
    run()