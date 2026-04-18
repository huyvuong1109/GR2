# -*- coding: utf-8 -*-
"""
Database Models - Raw DB + Analytics DB

raw.db      : giu nguyen cau truc bao cao (tung dong chi tieu) - dung cho trang xem BC
analytics.db: wide table theo loai cong ty - dung cho screener/phan tich
"""

from sqlalchemy import (
    BigInteger, Column, Float, ForeignKey,
    Integer, String, UniqueConstraint, create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, scoped_session

# ==============================================================================
# RAW DB - giu nguyen cau truc bao cao
# ==============================================================================

RawBase = declarative_base()


class RawCompany(RawBase):
    """Thong tin cong ty - lay tu MetadataExtractor"""
    __tablename__ = "companies"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    ticker        = Column(String(10),  unique=True, nullable=False, index=True)
    name          = Column(String(200), nullable=False)
    company_type  = Column(String(20),  nullable=False)   # corporate/bank/securities/insurance
    industry      = Column(String(100))

    periods = relationship("RawReportPeriod", back_populates="company",
                           cascade="all, delete-orphan")


class RawReportPeriod(RawBase):
    """
    Mot ky bao cao = 1 row.
    Luu metadata chung: don vi, loai BC, nguon file.
    """
    __tablename__ = "report_periods"
    __table_args__ = (
        UniqueConstraint("company_id", "quarter", "year",
                         "report_kind", name="uq_period"),
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    company_id   = Column(Integer, ForeignKey("companies.id"), nullable=False)
    quarter      = Column(Integer, nullable=False)   # 1-4
    year         = Column(Integer, nullable=False)
    report_kind  = Column(String(20), default="consolidated")
    # hop_nhat (consolidated) | cong_ty_me (parent)
    unit         = Column(String(20), default="VND")
    # don vi goc trong BC: VND | nghin_VND | trieu_VND | ty_VND
    unit_multiplier = Column(Float, default=1.0)
    # he so nhan de quy ve VND: 1 | 1000 | 1e6 | 1e9
    is_ytd       = Column(Integer, default=0)        # 1 neu la luy ke tu dau nam
    pdf_filename = Column(String(300))               # ten file PDF goc
    ocr_chars    = Column(Integer)                   # so ky tu sau OCR

    company = relationship("RawCompany", back_populates="periods")
    items   = relationship("RawReportItem", back_populates="period",
                           cascade="all, delete-orphan",
                           order_by="RawReportItem.item_order")


class RawReportItem(RawBase):
    """
    Tung dong chi tieu trong bao cao.
    Giu nguyen ten goc, thu tu, ma so de hien thi.
    """
    __tablename__ = "report_items"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    period_id   = Column(Integer, ForeignKey("report_periods.id"), nullable=False)
    statement   = Column(String(10), nullable=False)
    # CDKT | KQKD | LCTT
    item_order  = Column(Integer, nullable=False)    # thu tu dong trong bao cao
    item_code   = Column(String(20))                 # ma so chi tieu (100, 110, ...)
    item_name   = Column(String(300), nullable=False) # ten goc tu PDF
    notes_ref   = Column(String(50))                 # so thuyet minh
    value       = Column(BigInteger)                 # gia tri da quy ve VND
    slug        = Column(String(100))                # slug canonical (neu map duoc)

    period = relationship("RawReportPeriod", back_populates="items")


# ==============================================================================
# ANALYTICS DB - wide table theo loai cong ty
# ==============================================================================

AnalyticsBase = declarative_base()


class AnalyticsCompany(AnalyticsBase):
    """Thong tin cong ty trong analytics DB"""
    __tablename__ = "companies"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    ticker       = Column(String(10), unique=True, nullable=False, index=True)
    name         = Column(String(200), nullable=False)
    company_type = Column(String(20),  nullable=False)
    industry     = Column(String(100))


def _wide_table(base, tablename: str, slugs: list[str],
                extra_cols: dict | None = None):
    """
    Tao dong wide table tu list slug.
    extra_cols: {col_name: Column(...)} cho cac cot dac biet (VD: BigInteger thay Float)
    """
    attrs = {
        "__tablename__": tablename,
        "id":      Column(Integer, primary_key=True),
        "ticker":  Column(String(10), nullable=False, index=True),
        "quarter": Column(Integer,    nullable=False),
        "year":    Column(Integer,    nullable=False),
        "__table_args__": (
            UniqueConstraint("ticker", "quarter", "year", name=f"uq_{tablename}"),
        ),
    }
    for slug in slugs:
        attrs[slug] = Column(BigInteger, default=None)
    if extra_cols:
        attrs.update(extra_cols)
    return type(tablename.title().replace("_", ""), (base,), attrs)


# -- CORPORATE slugs (phi tai chinh) ------------------------------------------

CORPORATE_CDKT = [
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

CORPORATE_KQKD = [
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
    "loi_nhuan_cua_co_dong_ct_me",
    "eps_co_ban",
]

CORPORATE_LCTT = [
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

CORPORATE_SLUGS = CORPORATE_CDKT + CORPORATE_KQKD + CORPORATE_LCTT

# -- BANK slugs ----------------------------------------------------------------

BANK_CDKT = [
    # Tai san
    "tien_mat_vang_bac_da_quy",
    "tien_gui_tai_nhnn",
    "tien_gui_cho_vay_cac_tctd",
    "chung_khoan_kinh_doanh",
    "cho_vay_khach_hang",              # Gross loans
    "du_phong_rui_ro_cho_vay",         # Am - provision
    "chung_khoan_dau_tu",
    "gop_von_dau_tu_dai_han",
    "tai_san_co_dinh",
    "tai_san_co",                      # Other assets
    "tong_tai_san",
    # No phai tra
    "cac_khoan_no_chinh_phu_nhnn",
    "tien_gui_vay_cac_tctd",
    "tien_gui_khach_hang",             # Customer deposits
    "phat_hanh_giay_to_co_gia",
    "cac_khoan_no_khac",
    "tong_no_phai_tra",
    # Von chu so huu
    "von_dieu_le",
    "thang_du_von",
    "quy_du_tru",
    "loi_nhuan_chua_phan_phoi",
    "tong_von_chu_so_huu",
    "tong_nguon_von",
    # NPL - No xau theo nhom
    "no_nhom_1",                       # No du tieu chuan
    "no_nhom_2",                       # No can chu y
    "no_nhom_3",                       # No duoi tieu chuan
    "no_nhom_4",                       # No nghi ngo
    "no_nhom_5",                       # No co kha nang mat von
]

BANK_KQKD = [
    "thu_nhap_lai_thuan",              # Net Interest Income (NII)
    "lai_thuan_tu_dich_vu",            # Net Fee Income
    "lai_thuan_ngoai_hoi",             # Net Forex Gain
    "lai_thuan_chung_khoan",           # Net Securities Trading Gain
    "lai_thuan_mua_ban_chung_khoan_dau_tu",
    "thu_nhap_khac",                   # Other Income
    "tong_thu_nhap_hoat_dong",         # Total Operating Income (TOI)
    "chi_phi_hoat_dong",               # Operating Expenses (OPEX)
    "loi_nhuan_thuan_truoc_du_phong",  # Net Profit Before Provision
    "chi_phi_du_phong_rui_ro",         # Provision Expenses
    "loi_nhuan_truoc_thue",            # Profit Before Tax
    "chi_phi_thue_tndn",
    "loi_nhuan_sau_thue",
    "loi_nhuan_cua_co_dong_ct_me",
    "eps_co_ban",
]

BANK_LCTT = [
    "lctt_thuan_hdkd",
    "lctt_thuan_hddt",
    "lctt_thuan_hdtc",
    "tien_dau_ky",
    "tien_cuoi_ky",
]

BANK_SLUGS = BANK_CDKT + BANK_KQKD + BANK_LCTT

# -- SECURITIES slugs ----------------------------------------------------------

SECURITIES_CDKT = [
    "tien_va_tuong_duong_tien",
    "fvtpl",                           # Chung khoan FVTPL
    "afs",                             # Chung khoan AFS (san sang de ban)
    "htm",                             # Chung khoan HTM (giu den dao han)
    "cho_vay_margin",                  # Cho vay giao dich ky quy
    "phai_thu_khach_hang",
    "tai_san_ngan_han_khac",
    "tong_tai_san_ngan_han",
    "tai_san_co_dinh",
    "dau_tu_tai_chinh_dai_han",
    "tai_san_dai_han_khac",
    "tong_tai_san_dai_han",
    "tong_tai_san",
    "phai_tra_khach_hang",             # Tien cua nha dau tu gui
    "vay_ngan_han",
    "tong_no_ngan_han",
    "vay_dai_han",
    "tong_no_dai_han",
    "tong_no_phai_tra",
    "von_dieu_le",
    "thang_du_von",
    "loi_nhuan_chua_phan_phoi",
    "tong_von_chu_so_huu",
    "tong_nguon_von",
]

SECURITIES_KQKD = [
    "doanh_thu_moi_gioi",              # Phi moi gioi chung khoan
    "doanh_thu_tu_van",                # Phi tu van tai chinh
    "doanh_thu_ngan_hang_dau_tu",      # IB fees
    "lai_kinh_doanh_chung_khoan",      # Lai tu mua ban CK tu doanh
    "lai_cho_vay_margin",              # Lai tu cho vay margin
    "doanh_thu_quan_ly_quy",           # Phi quan ly quy
    "tong_doanh_thu_hoat_dong",
    "chi_phi_hoat_dong",
    "loi_nhuan_truoc_thue",
    "chi_phi_thue_tndn",
    "loi_nhuan_sau_thue",
    "eps_co_ban",
]

SECURITIES_LCTT = [
    "lctt_thuan_hdkd",
    "lctt_thuan_hddt",
    "lctt_thuan_hdtc",
    "tien_dau_ky",
    "tien_cuoi_ky",
]

SECURITIES_SLUGS = SECURITIES_CDKT + SECURITIES_KQKD + SECURITIES_LCTT

# -- INSURANCE slugs -----------------------------------------------------------

INSURANCE_CDKT = [
    "tien_va_tuong_duong_tien",
    "dau_tu_tai_chinh",
    "phai_thu_phi_bao_hiem",
    "tai_san_ngan_han_khac",
    "tong_tai_san_ngan_han",
    "tai_san_co_dinh",
    "tai_san_dai_han_khac",
    "tong_tai_san_dai_han",
    "tong_tai_san",
    "du_phong_nghiep_vu",              # Provision for insurance liabilities
    "phai_tra_nguoi_ban",
    "tong_no_phai_tra",
    "von_dieu_le",
    "loi_nhuan_chua_phan_phoi",
    "tong_von_chu_so_huu",
    "tong_nguon_von",
]

INSURANCE_KQKD = [
    "doanh_thu_phi_bao_hiem_goc",      # Gross premium revenue
    "phi_tai_bao_hiem",                # Reinsurance premium
    "doanh_thu_phi_bao_hiem_thuan",    # Net premium revenue
    "chi_boi_thuong",                  # Claims paid
    "chi_phi_khai_thac",               # Acquisition costs
    "chi_phi_quan_ly",
    "doanh_thu_hoat_dong_tai_chinh",
    "loi_nhuan_hoat_dong_bao_hiem",
    "loi_nhuan_truoc_thue",
    "chi_phi_thue_tndn",
    "loi_nhuan_sau_thue",
    "eps_co_ban",
]

INSURANCE_LCTT = [
    "lctt_thuan_hdkd",
    "lctt_thuan_hddt",
    "lctt_thuan_hdtc",
    "tien_dau_ky",
    "tien_cuoi_ky",
]

INSURANCE_SLUGS = INSURANCE_CDKT + INSURANCE_KQKD + INSURANCE_LCTT

# -- Tao cac wide table --------------------------------------------------------

FinancialsCorporate  = _wide_table(AnalyticsBase, "financials_corporate",  CORPORATE_SLUGS)
FinancialsBank       = _wide_table(AnalyticsBase, "financials_bank",       BANK_SLUGS)
FinancialsSecurities = _wide_table(AnalyticsBase, "financials_securities", SECURITIES_SLUGS)
FinancialsInsurance  = _wide_table(AnalyticsBase, "financials_insurance",  INSURANCE_SLUGS)

# Map loai cong ty -> (model, slug list)
ANALYTICS_TABLE_MAP = {
    "corporate":  (FinancialsCorporate,  CORPORATE_SLUGS),
    "bank":       (FinancialsBank,       BANK_SLUGS),
    "securities": (FinancialsSecurities, SECURITIES_SLUGS),
    "insurance":  (FinancialsInsurance,  INSURANCE_SLUGS),
}

# ==============================================================================
# DATA INTEGRITY CHECKS - validate logic cong tru trong bao cao ngan hang
# ==============================================================================

BANK_INTEGRITY_CHECKS = [
    {
        "name": "tong_thu_nhap_hoat_dong",
        "formula": [
            "thu_nhap_lai_thuan",
            "lai_thuan_tu_dich_vu",
            "lai_thuan_ngoai_hoi",
            "lai_thuan_chung_khoan",
            "lai_thuan_mua_ban_chung_khoan_dau_tu",
            "thu_nhap_khac",
        ],
        "result": "tong_thu_nhap_hoat_dong",
        "tolerance_pct": 5.0,   # cho phep sai so 5% do OCR
    },
    {
        "name": "loi_nhuan_thuan_truoc_du_phong",
        "formula": {
            "add": ["tong_thu_nhap_hoat_dong"],
            "sub": ["chi_phi_hoat_dong"],
        },
        "result": "loi_nhuan_thuan_truoc_du_phong",
        "tolerance_pct": 5.0,
    },
    {
        "name": "loi_nhuan_truoc_thue",
        "formula": {
            "add": ["tong_thu_nhap_hoat_dong"],
            "sub": ["chi_phi_hoat_dong", "chi_phi_du_phong_rui_ro"],
        },
        "result": "loi_nhuan_truoc_thue",
        "tolerance_pct": 5.0,
    },
    {
        "name": "npl_vs_gross_loans",
        "description": "Tong no nhom 1-5 xap xi bang cho_vay_khach_hang",
        "npl_groups": ["no_nhom_1", "no_nhom_2", "no_nhom_3", "no_nhom_4", "no_nhom_5"],
        "against": "cho_vay_khach_hang",
        "tolerance_pct": 2.0,
    },
]


def run_bank_integrity_checks(data: dict) -> list[dict]:
    """
    Chay tat ca integrity checks cho bao cao ngan hang.
    data: {slug: value} cho 1 ky bao cao.
    Tra ve list cac check that bai.
    """
    failures = []

    for check in BANK_INTEGRITY_CHECKS:
        name = check["name"]

        if name == "npl_vs_gross_loans":
            groups = check["npl_groups"]
            against = check["against"]
            tol = check["tolerance_pct"] / 100

            total_npl = sum(data.get(g) or 0 for g in groups)
            gross_loans = data.get(against) or 0

            if gross_loans and total_npl:
                diff_pct = abs(total_npl - gross_loans) / abs(gross_loans)
                if diff_pct > tol:
                    failures.append({
                        "check": name,
                        "expected": gross_loans,
                        "got": total_npl,
                        "diff_pct": round(diff_pct * 100, 2),
                    })
            continue

        result_slug = check["result"]
        result_val = data.get(result_slug)
        if result_val is None:
            continue

        formula = check["formula"]
        if isinstance(formula, list):
            # Don gian: tong cong tat ca
            computed = sum(data.get(s) or 0 for s in formula)
        else:
            # add - sub
            computed = sum(data.get(s) or 0 for s in formula.get("add", []))
            computed -= sum(data.get(s) or 0 for s in formula.get("sub", []))

        if result_val == 0:
            continue

        tol = check["tolerance_pct"] / 100
        diff_pct = abs(computed - result_val) / abs(result_val)
        if diff_pct > tol:
            failures.append({
                "check": name,
                "expected": result_val,
                "computed": computed,
                "diff_pct": round(diff_pct * 100, 2),
            })

    return failures


# ==============================================================================
# FACTORY - tao engine + session cho tung DB
# ==============================================================================

def make_raw_engine(db_path: str):
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"timeout": 30, "check_same_thread": False},
    )
    RawBase.metadata.create_all(engine)
    return engine


def make_analytics_engine(db_path: str):
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"timeout": 30, "check_same_thread": False},
    )
    AnalyticsBase.metadata.create_all(engine)
    return engine


def make_session(engine):
    return scoped_session(sessionmaker(bind=engine))