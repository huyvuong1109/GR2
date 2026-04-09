# -*- coding: utf-8 -*-
"""
canonical_map.py - Map ten chi tieu OCR/LLM -> slug chuan.

Phien ban nay fix cac pattern con lai tu log:
  - "Nguyen gia", "Gia tri hao mon luy ke"          -> tai_san_co_dinh_huu_hinh
  - "&#124; 5. Quy dau tu phat trien"               -> quy_dau_tu_phat_trien
  - "LNST chua phan phoi l) nay"                    -> loi_nhuan_sau_thue_chua_phan_phoi
  - "1. Tai san co dinh huu hinh"                   -> tai_san_co_dinh_huu_hinh
  - "11. Loi nhuan tu HDKD{30=20+...}"              -> loi_nhuan_thuan_hdkd
  - "18.1 Loi ich cua co dong thieu so"             -> loi_ich_co_dong_khong_kiem_soat
  - "Co tuc, loi nhuan da tra cho chu so huu"       -> co_tuc_da_tra
  - "Anh huong cua thay doi ty gia hoi doai..."     -> anh_huong_ty_gia_hoi_doai
  - "II. Bat dong san dau tu"                       -> bat_dong_san_dau_tu
  - "V. Cac khoan dau tu tai chinh dai han"         -> dau_tu_tai_chinh_dai_han
  - "s. Dau tu nam giu den ngay dao han"            -> dau_tu_tai_chinh_ngan_han
  - "§. Phan lai (lo) trong cong ty lien doanh"     -> phan_lai_lo_trong_cong_ty_lien_doanh
  - "I 7. Loi ich cua co dong khong kiem soat"      -> loi_ich_co_dong_khong_kiem_soat
  - "Ong phan phoi lay ke den cuoi k}"              -> loi_nhuan_sau_thue_chua_phan_phoi (OCR rac)
  - "An DAN,HANG, VAICONG" (OCR rac hoan toan)      -> bo qua (None)
"""

import re
import unicodedata


# ==============================================================================
# NORMALIZE
# ==============================================================================

def _norm(text: str) -> str:
    """Bo dau, thuong hoa, chuan hoa khoang trang."""
    nfkd = unicodedata.normalize("NFKD", text or "")
    t = "".join(c for c in nfkd if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-zA-Z0-9\s]", " ", t).lower()
    return re.sub(r"\s+", " ", t).strip()


# ==============================================================================
# PRE-PROCESS — lam sach truoc khi lookup
# ==============================================================================

# Pattern OCR rac hoan toan: khong co chu thuong tieng Viet / tieng Anh co nghia
_GARBAGE_RE = re.compile(
    r"^[A-Z\s,\.\!\?\|&#;0-9/\\]+$"     # toan chu hoa + ky tu dac biet
    r"|^[\W\d\s]{0,5}$"                  # qua ngan, toan ky tu dac biet
)

# Prefix OCR rac dau dong (unicode border, HTML entity, ky tu nham)
_PREFIX_JUNK_RE = re.compile(
    r"^(?:"
    r"&#\d+;|"                           # HTML entity: &#124;
    r"[|Ì Í§¦]+|"                        # unicode border / dau la
    r"[IVXivx]{1,4}\."                   # so La Ma dot
    r")\s*"
)

# So thu tu dau dong: "1. ", "10. ", "1) ", "A. ", "I. ", "II. ", "IV. ", "s. "
_ORDER_PREFIX_RE = re.compile(
    r"^(?:"
    r"[0-9]{1,3}[\.\)\-]\s+"            # 1. / 10. / 1) / 1-
    r"|[IVXivx]{1,4}[\.\)\-]\s+"        # I. / II. / IV. / IX.
    r"|[A-Da-d][\.\)]\s+"               # A. / B. / a. / b.
    r"|[a-z]{1,2}\.\s+"                 # s. / il. (OCR nham chu thanh so La Ma)
    r")"
)

# So chi tieu dau dong kep: "18.1 ", "3, "
_SUB_ORDER_RE = re.compile(r"^[0-9]+[,\.][0-9]*\s+")

# Cong thuc trong ngoac nhon: {30=20+(21-22)-...}
_FORMULA_RE = re.compile(r"\{[^}]*\}")

# Ngoac chua ma so / don vi
_PAREN_CODE_RE  = re.compile(r"\(\s*\d+\s*\)")
_PAREN_UNIT_RE  = re.compile(
    r"\(\s*(?:trieu|ty|nghin|dong|vnd|usd)\s*(?:dong)?\s*\)",
    flags=re.IGNORECASE,
)
_PAREN_PCT_RE   = re.compile(r"\s*\(%\)\s*$")
_PAREN_MDON_RE  = re.compile(r"\s*\(trieu dong\)\s*$", flags=re.IGNORECASE)
_THUYET_MINH_RE = re.compile(r"thuyet\s*minh\s*\d*", flags=re.IGNORECASE)

# Dau (*) o cuoi (hay xuat hien o "Gia tri hao mon luy ke (*)")
_TRAILING_STAR_RE = re.compile(r"\s*\(\s*\*+\s*\)\s*$")

# Chu "nay" / "cuoi ky" / "dau ky" doc lap o cuoi (OCR cat ngan)
_TRAILING_NOISE_RE = re.compile(r"\s+(?:nay|truoc|cuoi ky|dau ky)\s*$", flags=re.IGNORECASE)


def _preprocess(name: str) -> str:
    """
    Lam sach ten chi tieu truoc khi lookup.
    Tra ve chuoi rong neu la rac hoan toan.
    """
    t = name.strip()
    if not t:
        return ""

    # Loai rac hoan toan (toan chu hoa + ky tu la, khong co tu co nghia)
    if _GARBAGE_RE.match(t) and len(t) < 30:
        return ""

    # Bo HTML entity dau dong
    t = re.sub(r"^&#\d+;\s*", "", t).strip()

    # Bo prefix OCR rac dau dong (|, Ì, §, &#124;...)
    t = _PREFIX_JUNK_RE.sub("", t).strip()

    # Bo so thu tu: "1. ", "II. ", "s. " ...
    # Lap 2 lan de xu ly kep nhu "II. 1. "
    for _ in range(2):
        t = _ORDER_PREFIX_RE.sub("", t).strip()

    # Bo so chi tieu phu: "18.1 ", "3, "
    t = _SUB_ORDER_RE.sub("", t).strip()

    # Bo cong thuc
    t = _FORMULA_RE.sub("", t).strip()

    # Bo dau (*) o cuoi
    t = _TRAILING_STAR_RE.sub("", t).strip()

    # Bo ngoac chua ma so / don vi
    t = _PAREN_CODE_RE.sub("", t)
    t = _PAREN_UNIT_RE.sub("", t)
    t = _PAREN_PCT_RE.sub("", t)
    t = _PAREN_MDON_RE.sub("", t)
    t = _THUYET_MINH_RE.sub("", t)

    # Bo "nay", "truoc" doc lap o cuoi (OCR cat "ky nay" -> "nay")
    t = _TRAILING_NOISE_RE.sub("", t)

    # Chuan hoa khoang trang
    t = re.sub(r"\s+", " ", t).strip()

    # Neu qua ngan sau lam sach -> rac
    if len(t) < 3:
        return ""

    return t


# ==============================================================================
# CORPORATE MAP
# ==============================================================================

CORPORATE_MAP: dict[str, list[str]] = {
    # ── CDKT ──────────────────────────────────────────────────────────────────
    "tien_va_tuong_duong_tien": [
        "tien va cac khoan tuong duong tien", "tien mat",
        "cash and cash equivalents", "tien va tuong duong",
        "tien mat va tuong duong tien", "tien", "cash",
    ],
    "dau_tu_tai_chinh_ngan_han": [
        "dau tu tai chinh ngan han", "chung khoan kinh doanh ngan han",
        "short term investments", "dau tu ngan han",
        "cac khoan dau tu tai chinh ngan han",
        "dau tu nam giu den ngay dao han ngan han",
        # "s. Dau tu nam giu den ngay dao han" -> sau preprocess -> "dau tu nam giu den ngay dao han"
        "dau tu nam giu den ngay dao han",
    ],
    "phai_thu_ngan_han_khach_hang": [
        "phai thu ngan han cua khach hang", "phai thu khach hang",
        "accounts receivable", "phai thu ngan han khach",
        "phai thu khach hang ngan han", "cac khoan phai thu ngan han",
    ],
    "phai_thu_ngan_han_khac": [
        "phai thu ngan han khac", "other receivables",
        "cac khoan phai thu khac",
        "thue gtgt duoc khau tru",          # "2. Thue GTGT duoc khau tru"
        "thue va cac khoan khac phai thu nha nuoc",
        "du phong phai thu ngan han kho doi",
        "phai thu ngan han kho doi",
    ],
    "hang_ton_kho": [
        "hang ton kho", "inventories", "ton kho",
        "chi phi san xuat kinh doanh do dang",
    ],
    "tai_san_ngan_han_khac": [
        "tai san ngan han khac", "other current assets",
        "chi phi tra truoc ngan han", "tai san thieu cho xu ly",
    ],
    "tong_tai_san_ngan_han": [
        "tong tai san ngan han", "total current assets", "a tong cong",
        "tai san ngan han", "a tong tai san ngan han",
    ],
    "phai_thu_dai_han": [
        "phai thu dai han", "long term receivables",
        "tra truoc cho nguoi ban dai han",
    ],
    # Cac thanh phan cua TSCD huu hinh (log: "Nguyen gia", "Gia tri hao mon luy ke")
    # -> map vao slug cha de tranh NULL
    "tai_san_co_dinh_huu_hinh": [
        "tai san co dinh huu hinh", "property plant equipment",
        "tai san co dinh net", "tscd huu hinh",
        "tai san co dinh",
        "nguyen gia",                        # "Nguyen gia" cua TSCD
        "nguyen gia tai san co dinh",
        "gia tri hao mon luy ke",            # "Gia tri hao mon luy ke"
        "gia tri hao mon luy ke",
        "hao mon luy ke",
    ],
    "tai_san_co_dinh_vo_hinh": [
        "tai san co dinh vo hinh", "intangible assets", "loi the thuong mai",
    ],
    "bat_dong_san_dau_tu": [
        "bat dong san dau tu", "investment properties",
        # "II. Bat dong san dau tu" -> sau preprocess -> "bat dong san dau tu"
    ],
    "tai_san_co_dinh_xay_dung_do_dang": [
        "tai san xay dung co ban do dang", "construction in progress",
        "tai san do dang dai han", "chi phi xay dung co ban do dang",
        "xay dung co ban do dang",
    ],
    "dau_tu_tai_chinh_dai_han": [
        "dau tu tai chinh dai han", "long term investments",
        "dau tu vao cong ty con", "dau tu vao cong ty lien ket",
        "cac khoan dau tu tai chinh dai han",
        "dau tu vao cong ty lien doanh lien ket",
        "dau tu dai han khac",
        # "V. Cac khoan dau tu tai chinh dai han" -> sau preprocess OK
        # "3, Dau tu dai han khac" -> sau preprocess -> "dau tu dai han khac"
        "du phong giam gia dau tu tai chinh dai han",
    ],
    "tai_san_thue_thu_nhap_hoan_lai": [
        "tai san thue thu nhap hoan lai", "deferred tax asset",
    ],
    "tai_san_dai_han_khac": [
        "tai san dai han khac", "other non current assets",
        "chi phi tra truoc dai han",
    ],
    "tong_tai_san_dai_han": [
        "tong tai san dai han", "total non current assets", "b tong cong",
        "tai san dai han", "b tong tai san dai han",
    ],
    "tong_tai_san": [
        "tong cong tai san", "tong tai san", "total assets",
        "tong cong tai san a b",
    ],
    "vay_ngan_han": [
        "vay va no thue tai chinh ngan han", "vay ngan han",
        "short term borrowings", "vay ngan han va dai han den han tra",
    ],
    "phai_tra_nguoi_ban_ngan_han": [
        "phai tra nguoi ban ngan han", "accounts payable",
        "phai tra nha cung cap", "phai tra nguoi ban",
    ],
    "nguoi_mua_tra_tien_truoc_ngan_han": [
        "nguoi mua tra tien truoc ngan han", "advance from customers",
    ],
    "thue_va_cac_khoan_phai_nop": [
        "thue va cac khoan phai nop nha nuoc", "taxes payable",
    ],
    "phai_tra_nguoi_lao_dong": [
        "phai tra nguoi lao dong", "payables to employees",
        # "4. Phai tra nguoi lao dong" -> sau preprocess OK
    ],
    "chi_phi_phai_tra_ngan_han":   ["chi phi phai tra ngan han", "accrued liabilities"],
    "du_phong_phai_tra_ngan_han":  ["du phong phai tra ngan han"],
    "phai_tra_ngan_han_khac":      ["phai tra ngan han khac", "other current liabilities"],
    "tong_no_ngan_han": [
        "tong no ngan han", "total current liabilities", "no ngan han",
    ],
    "vay_dai_han": [
        "vay va no thue tai chinh dai han", "vay dai han", "long term borrowings",
        "phai tra nguoi ban dai han",
    ],
    "thue_thu_nhap_hoan_lai_phai_tra": [
        "thue thu nhap hoan lai phai tra", "deferred tax liability",
    ],
    "du_phong_phai_tra_dai_han":   ["du phong phai tra dai han"],
    "phai_tra_dai_han_khac":       ["phai tra dai han khac", "other non current liabilities"],
    "tong_no_dai_han": [
        "tong no dai han", "total non current liabilities", "no dai han",
    ],
    "tong_no_phai_tra": [
        "tong no phai tra", "total liabilities", "tong cong no phai tra", "no phai tra",
    ],
    "von_gop_cua_chu_so_huu": [
        "von gop cua chu so huu", "von dieu le", "charter capital",
        "share capital", "co phan pho thong",
        "von dau tu cua chu so huu",
        # "1. Von dau tu cua chu so huu" -> sau preprocess -> "von dau tu cua chu so huu"
    ],
    "thang_du_von_co_phan": [
        "thang du von co phan", "share premium", "von khac cua chu so huu",
    ],
    "co_phieu_quy":            ["co phieu quy", "treasury shares"],
    "quy_dau_tu_phat_trien":   [
        "quy dau tu phat trien", "development fund",
        # "&#124; 5. Quy dau tu phat trien" -> sau preprocess -> "quy dau tu phat trien"
    ],
    "quy_khen_thuong_phuc_loi": ["quy khen thuong phuc loi", "bonus welfare fund"],
    "loi_ich_co_dong_khong_kiem_soat": [
        "loi ich cua co dong khong kiem soat",
        "loi ich cua co dong thieu so",
        "non controlling interest", "minority interest",
        "loi ich co dong thieu so",
        # "I 7. Loi ich cua co dong khong kiem soat" -> sau preprocess -> "loi ich cua co dong khong kiem soat"
        # "Ì 7. Loi ich..." -> _PREFIX_JUNK_RE bo "Ì" -> "7. Loi ich..." -> _ORDER_PREFIX_RE bo "7." -> OK
    ],
    "loi_nhuan_sau_thue_chua_phan_phoi": [
        "loi nhuan sau thue chua phan phoi", "retained earnings",
        "loi nhuan chua phan phoi",
        "lnst chua phan phoi luy ke den cuoi ky",
        # "LNST chua phan phoi l) nay" -> norm -> "lnst chua phan phoi l nay"
        # -> substring "lnst chua phan phoi" match
        "lnst chua phan phoi",
        # "Ong phan phoi lay ke den cuoi k}" -> sau norm -> "ong phan phoi lay ke den cuoi k"
        # -> khong match truc tiep nhung "phan phoi" substring co the match
        # them "phan phoi" la keyword qua ngan, thay vao them alias cu the hon
        "phan phoi luy ke den cuoi ky",
        "lnst chua phan phoi luy ke",
    ],
    "tong_von_chu_so_huu": [
        "tong von chu so huu", "total equity", "von chu so huu", "vcsh",
    ],
    "tong_nguon_von": [
        "tong nguon von", "tong cong nguon von", "total liabilities and equity",
    ],

    # ── KQKD ──────────────────────────────────────────────────────────────────
    "doanh_thu_ban_hang_va_ccdv": [
        "doanh thu ban hang va cung cap dich vu", "revenue",
        "doanh thu thuan ve ban hang", "net revenue from sales", "doanh thu",
    ],
    "cac_khoan_giam_tru_doanh_thu": [
        "cac khoan giam tru doanh thu", "deductions from revenue",
    ],
    "doanh_thu_thuan": [
        "doanh thu thuan", "net revenue", "net sales",
        "doanh thu thuan ve ban hang va cung cap dich vu",
    ],
    "gia_von_hang_ban": [
        "gia von hang ban", "cost of goods sold", "cost of sales", "gia von", "cogs",
    ],
    "loi_nhuan_gop": [
        "loi nhuan gop ve ban hang", "gross profit", "loi nhuan gop",
    ],
    "doanh_thu_hoat_dong_tai_chinh": [
        "doanh thu hoat dong tai chinh", "financial income",
    ],
    "chi_phi_tai_chinh": [
        "chi phi tai chinh", "financial expenses", "chi phi lai vay",
    ],
    "phan_lai_lo_trong_cong_ty_lien_doanh": [
        "phan lai lo trong cong ty lien doanh lien ket",
        "share of profit loss in associates",
        "phan lai lo trong cong ty lien doanh",
        # "§. Phan lai (lo) trong cong ty lien doanh" -> sau preprocess -> "phan lai lo trong cong ty lien doanh"
    ],
    "chi_phi_ban_hang": [
        "chi phi ban hang", "selling expenses", "chi phi ban hang va quan ly",
    ],
    "chi_phi_quan_ly_dn": [
        "chi phi quan ly doanh nghiep", "general and administrative",
    ],
    "loi_nhuan_thuan_hdkd": [
        "loi nhuan thuan tu hoat dong kinh doanh", "operating profit",
        "loi nhuan hoat dong", "ebit",
        "loi nhuan tu hoat dong kinh doanh",
        # "11. Loi nhuan tu hoat dong kinh doanh{30=20+...}" -> sau preprocess
        # -> "loi nhuan tu hoat dong kinh doanh" -> match "loi nhuan tu hoat dong kinh doanh"
    ],
    "thu_nhap_khac":           ["thu nhap khac", "other income"],
    "chi_phi_khac":            ["chi phi khac", "other expenses"],
    "loi_nhuan_khac":          ["loi nhuan khac", "other profit"],
    "loi_nhuan_truoc_thue": [
        "tong loi nhuan ke toan truoc thue", "profit before tax",
        "loi nhuan truoc thue", "earnings before tax", "ebt",
    ],
    "chi_phi_thue_tndn_hien_hanh": [
        "chi phi thue thu nhap doanh nghiep hien hanh",
        "chi phi thue tndn hien hanh", "current income tax expense",
    ],
    "chi_phi_thue_tndn_hoan_lai": [
        "chi phi thue thu nhap doanh nghiep hoan lai",
        "chi phi thue tndn hoan lai", "deferred income tax expense",
    ],
    "chi_phi_thue_tndn": [
        "chi phi thue thu nhap doanh nghiep", "income tax expense",
    ],
    "loi_nhuan_sau_thue": [
        "loi nhuan sau thue thu nhap doanh nghiep", "profit after tax",
        "net profit", "loi nhuan sau thue", "net income",
    ],
    "loi_nhuan_cua_co_dong_khong_kiem_soat": [
        "loi ich cua co dong khong kiem soat kqkd",
        "loi nhuan cua co dong thieu so", "minority interest profit",
        # "18.1 Loi ich cua co dong thieu so" -> sau preprocess -> "loi ich cua co dong thieu so"
        "loi ich cua co dong thieu so",
    ],
    "loi_nhuan_cua_co_dong_ct_me": [
        "loi nhuan cua co dong cong ty me", "profit attributable to parent",
        "lnst cua co dong cong ty me", "loi nhuan co dong cong ty me",
    ],
    "eps_co_ban":              ["lai co ban tren co phieu", "basic eps"],

    # ── LCTT ──────────────────────────────────────────────────────────────────
    "lctt_truoc_thay_doi_von_luu_dong": [
        "luu chuyen tien thuan tu hoat dong kinh doanh truoc",
    ],
    "thay_doi_khoan_phai_thu": [
        "tang giam cac khoan phai thu", "change in receivables",
    ],
    "thay_doi_hang_ton_kho":   ["tang giam hang ton kho", "change in inventories"],
    "thay_doi_khoan_phai_tra": ["tang giam cac khoan phai tra", "change in payables"],
    "anh_huong_ty_gia_hoi_doai": [
        "anh huong cua thay doi ty gia hoi doai quy doi ngoai te",
        "effect of exchange rate changes", "anh huong thay doi ty gia",
        # "Anh huong cua thay doi ty gia hoi doai quy doi ngoai te" -> sau _norm OK
    ],
    "lctt_thuan_hdkd": [
        "luu chuyen tien thuan tu hoat dong kinh doanh",
        "net cash from operating activities",
        "tien tu hoat dong kinh doanh", "cfo",
    ],
    "tien_mua_tai_san_co_dinh": [
        "tien chi de mua sam tai san co dinh", "purchase of fixed assets",
    ],
    "tien_thu_thanh_ly_tscdd": [
        "tien thu tu thanh ly nhuong ban tai san co dinh",
    ],
    "tien_chi_dau_tu_gop_von": ["tien chi dau tu gop von vao don vi khac"],
    "tien_thu_dau_tu_gop_von": ["tien thu hoi dau tu gop von vao don vi khac"],
    "lctt_thuan_hddt": [
        "luu chuyen tien thuan tu hoat dong dau tu",
        "net cash from investing activities",
        "tien tu hoat dong dau tu", "cfi",
    ],
    "tien_thu_vay":            ["tien thu tu di vay", "proceeds from borrowings"],
    "tien_tra_no_vay":         ["tien tra no goc vay", "repayment of borrowings"],
    "co_tuc_da_tra": [
        "co tuc loi nhuan da tra cho chu so huu", "dividends paid",
        "co tuc loi nhuan da tra",
        # "Co tuc, loi nhuan da tra cho chu so huu" -> sau _norm -> "co tuc loi nhuan da tra cho chu so huu"
    ],
    "lctt_thuan_hdtc": [
        "luu chuyen tien thuan tu hoat dong tai chinh",
        "net cash from financing activities",
        "tien tu hoat dong tai chinh", "cff",
    ],
    "tien_dau_ky": ["tien va tuong duong tien dau ky", "cash at beginning"],
    "tien_cuoi_ky": ["tien va tuong duong tien cuoi ky", "cash at end"],
}


# ==============================================================================
# BANK MAP
# ==============================================================================

BANK_MAP: dict[str, list[str]] = {
    "tien_mat_vang_bac_da_quy":   ["tien mat vang bac da quy", "cash gold silver"],
    "tien_gui_tai_nhnn":          ["tien gui tai ngan hang nha nuoc", "deposits at sbv"],
    "tien_gui_cho_vay_cac_tctd":  ["tien gui va cho vay cac to chuc tin dung", "due from banks"],
    "chung_khoan_kinh_doanh":     ["chung khoan kinh doanh", "trading securities"],
    "cho_vay_khach_hang": [
        "cho vay khach hang", "gross loans", "du no cho vay khach hang",
        "cho vay va ung truoc khach hang", "cho vay", "du no cho vay",
    ],
    "du_phong_rui_ro_cho_vay": [
        "du phong rui ro cho vay khach hang", "provision for loans",
        "du phong cu the va chung", "trich lap du phong rui ro",
    ],
    "chung_khoan_dau_tu":         ["chung khoan dau tu", "investment securities", "afs htam"],
    "gop_von_dau_tu_dai_han":     ["gop von dau tu dai han", "long term investments"],
    "tai_san_co_dinh":            ["tai san co dinh", "fixed assets"],
    "tai_san_co":                 ["tai san co khac", "other assets"],
    "tong_tai_san":               ["tong tai san", "total assets"],
    "cac_khoan_no_chinh_phu_nhnn": [
        "cac khoan no chinh phu va ngan hang nha nuoc", "borrowings from government sbv",
    ],
    "tien_gui_vay_cac_tctd":      ["tien gui va vay cac to chuc tin dung", "due to banks"],
    "tien_gui_khach_hang": [
        "tien gui cua khach hang", "customer deposits",
        "nhan tien gui cua khach hang", "tien gui khach hang", "huy dong von",
    ],
    "phat_hanh_giay_to_co_gia":   ["phat hanh giay to co gia", "issued valuable papers"],
    "cac_khoan_no_khac":          ["cac khoan no khac", "other liabilities"],
    "tong_no_phai_tra":           ["tong no phai tra", "total liabilities"],
    "von_dieu_le":                ["von dieu le", "charter capital", "share capital"],
    "thang_du_von":               ["thang du von co phan", "share premium"],
    "quy_du_tru":                 ["quy du tru", "reserve fund"],
    "loi_nhuan_chua_phan_phoi": [
        "loi nhuan chua phan phoi", "retained earnings",
        "loi nhuan sau thue chua phan phoi",
    ],
    "tong_von_chu_so_huu":        ["tong von chu so huu", "total equity"],
    "tong_nguon_von":             ["tong nguon von", "tong cong nguon von", "total liabilities and equity"],
    "no_nhom_1":  ["no nhom 1", "no du tieu chuan", "nhom 1", "standard", "no xau nhom 1"],
    "no_nhom_2":  ["no nhom 2", "no can chu y", "nhom 2", "watch", "no xau nhom 2"],
    "no_nhom_3":  ["no nhom 3", "no duoi tieu chuan", "nhom 3", "substandard", "no xau nhom 3"],
    "no_nhom_4":  ["no nhom 4", "no nghi ngo", "nhom 4", "doubtful", "no xau nhom 4"],
    "no_nhom_5":  ["no nhom 5", "no co kha nang mat von", "nhom 5", "loss", "no mat von", "no xau nhom 5"],
    "thu_nhap_lai_thuan": [
        "thu nhap lai thuan", "net interest income", "nii",
        "thu nhap lai va cac khoan thu nhap tuong tu", "thu nhap lai",
    ],
    "lai_thuan_tu_dich_vu":       ["lai thuan tu hoat dong dich vu", "net fee income", "phi dich vu thuan", "lai tu dich vu"],
    "lai_thuan_ngoai_hoi":        ["lai thuan tu kinh doanh ngoai hoi va vang", "net forex gain", "lai thuan kinh doanh ngoai te"],
    "lai_thuan_chung_khoan":      ["lai thuan tu mua ban chung khoan kinh doanh", "net trading gain", "lai thuan kinh doanh chung khoan"],
    "lai_thuan_mua_ban_chung_khoan_dau_tu": ["lai thuan tu mua ban chung khoan dau tu", "gain on investment securities"],
    "thu_nhap_khac":              ["thu nhap hoat dong khac", "thu nhap khac", "other income"],
    "tong_thu_nhap_hoat_dong":    ["tong thu nhap hoat dong", "total operating income", "toi", "tong thu nhap truoc du phong", "tong thu nhap"],
    "chi_phi_hoat_dong":          ["chi phi hoat dong", "operating expenses", "opex", "tong chi phi hoat dong"],
    "loi_nhuan_thuan_truoc_du_phong": [
        "loi nhuan thuan tu hoat dong kinh doanh truoc chi phi du phong",
        "net profit before provision", "loi nhuan truoc du phong",
        "loi nhuan thuan truoc du phong",
    ],
    "chi_phi_du_phong_rui_ro": [
        "chi phi du phong rui ro tin dung", "provision expenses",
        "du phong rui ro", "chi phi trich lap du phong", "du phong", "provision",
    ],
    "loi_nhuan_truoc_thue":       ["loi nhuan truoc thue", "profit before tax"],
    "chi_phi_thue_tndn":          ["chi phi thue thu nhap doanh nghiep", "income tax expense"],
    "loi_nhuan_sau_thue":         ["loi nhuan sau thue", "profit after tax", "net profit"],
    "loi_nhuan_cua_co_dong_ct_me": ["loi nhuan cua co dong cong ty me", "profit attributable to parent"],
    "eps_co_ban":                 ["lai co ban tren co phieu", "basic eps"],
    "lctt_thuan_hdkd":            ["luu chuyen tien thuan tu hoat dong kinh doanh", "net cash from operations", "cfo"],
    "lctt_thuan_hddt":            ["luu chuyen tien thuan tu hoat dong dau tu", "net cash from investing", "cfi"],
    "lctt_thuan_hdtc":            ["luu chuyen tien thuan tu hoat dong tai chinh", "net cash from financing", "cff"],
    "tien_dau_ky":                ["tien va tuong duong tien dau ky", "cash at beginning"],
    "tien_cuoi_ky":               ["tien va tuong duong tien cuoi ky", "cash at end"],
}


# ==============================================================================
# SECURITIES MAP
# ==============================================================================

SECURITIES_MAP: dict[str, list[str]] = {
    "tien_va_tuong_duong_tien":   ["tien va cac khoan tuong duong tien", "cash and equivalents"],
    "fvtpl":                      ["chung khoan fvtpl", "chung khoan ghi nhan theo gia tri hop ly qua lai suat", "fvtpl", "tai san tai chinh ghi nhan theo fvtpl"],
    "afs":                        ["chung khoan san sang de ban", "afs", "available for sale", "chung khoan dau tu san sang de ban"],
    "htm":                        ["chung khoan giu den ngay dao han", "htm", "held to maturity"],
    "cho_vay_margin":             ["cho vay giao dich ky quy", "margin loans", "cho vay margin", "phai thu cho vay giao dich ky quy"],
    "phai_thu_khach_hang":        ["phai thu khach hang", "receivables from customers"],
    "tai_san_ngan_han_khac":      ["tai san ngan han khac", "other current assets"],
    "tong_tai_san_ngan_han":      ["tong tai san ngan han", "total current assets"],
    "tai_san_co_dinh":            ["tai san co dinh", "fixed assets"],
    "dau_tu_tai_chinh_dai_han":   ["dau tu tai chinh dai han", "long term investments"],
    "tai_san_dai_han_khac":       ["tai san dai han khac", "other non current assets"],
    "tong_tai_san_dai_han":       ["tong tai san dai han", "total non current assets"],
    "tong_tai_san":               ["tong tai san", "total assets"],
    "phai_tra_khach_hang":        ["phai tra khach hang", "tien cua nha dau tu", "payables to customers", "tien cua khach hang"],
    "vay_ngan_han":               ["vay ngan han", "short term borrowings"],
    "tong_no_ngan_han":           ["tong no ngan han", "total current liabilities"],
    "vay_dai_han":                ["vay dai han", "long term borrowings"],
    "tong_no_dai_han":            ["tong no dai han", "total non current liabilities"],
    "tong_no_phai_tra":           ["tong no phai tra", "total liabilities"],
    "von_dieu_le":                ["von dieu le", "charter capital"],
    "thang_du_von":               ["thang du von co phan", "share premium"],
    "loi_nhuan_chua_phan_phoi":   ["loi nhuan chua phan phoi", "retained earnings"],
    "tong_von_chu_so_huu":        ["tong von chu so huu", "total equity"],
    "tong_nguon_von":             ["tong nguon von", "total liabilities and equity"],
    "doanh_thu_moi_gioi":         ["doanh thu moi gioi chung khoan", "brokerage revenue", "phi moi gioi", "hoa hong moi gioi"],
    "doanh_thu_tu_van":           ["doanh thu tu van tai chinh", "advisory fees", "phi tu van"],
    "doanh_thu_ngan_hang_dau_tu": ["doanh thu ngan hang dau tu", "investment banking fees", "ib fees"],
    "lai_kinh_doanh_chung_khoan": ["lai tu mua ban chung khoan tu doanh", "proprietary trading gain", "kinh doanh chung khoan tu doanh"],
    "lai_cho_vay_margin":         ["lai tu cho vay giao dich ky quy", "interest from margin lending"],
    "doanh_thu_quan_ly_quy":      ["phi quan ly quy", "fund management fees"],
    "tong_doanh_thu_hoat_dong":   ["tong doanh thu hoat dong", "total operating revenue"],
    "chi_phi_hoat_dong":          ["chi phi hoat dong", "operating expenses"],
    "loi_nhuan_truoc_thue":       ["loi nhuan truoc thue", "profit before tax"],
    "chi_phi_thue_tndn":          ["chi phi thue thu nhap doanh nghiep", "income tax expense"],
    "loi_nhuan_sau_thue":         ["loi nhuan sau thue", "net profit"],
    "eps_co_ban":                 ["lai co ban tren co phieu", "basic eps"],
    "lctt_thuan_hdkd":            ["luu chuyen tien thuan tu hoat dong kinh doanh", "net cash from operations"],
    "lctt_thuan_hddt":            ["luu chuyen tien thuan tu hoat dong dau tu", "net cash from investing"],
    "lctt_thuan_hdtc":            ["luu chuyen tien thuan tu hoat dong tai chinh", "net cash from financing"],
    "tien_dau_ky":                ["tien va tuong duong tien dau ky", "cash at beginning"],
    "tien_cuoi_ky":               ["tien va tuong duong tien cuoi ky", "cash at end"],
}


# ==============================================================================
# INSURANCE MAP
# ==============================================================================

INSURANCE_MAP: dict[str, list[str]] = {
    "tien_va_tuong_duong_tien":   ["tien va cac khoan tuong duong tien", "cash and equivalents"],
    "dau_tu_tai_chinh":           ["dau tu tai chinh", "financial investments"],
    "phai_thu_phi_bao_hiem":      ["phai thu phi bao hiem", "insurance premium receivables", "phai thu ve hoat dong bao hiem"],
    "tai_san_ngan_han_khac":      ["tai san ngan han khac", "other current assets"],
    "tong_tai_san_ngan_han":      ["tong tai san ngan han", "total current assets"],
    "tai_san_co_dinh":            ["tai san co dinh", "fixed assets"],
    "tai_san_dai_han_khac":       ["tai san dai han khac", "other non current assets"],
    "tong_tai_san_dai_han":       ["tong tai san dai han", "total non current assets"],
    "tong_tai_san":               ["tong tai san", "total assets"],
    "du_phong_nghiep_vu":         ["du phong nghiep vu bao hiem", "provision for insurance liabilities", "du phong bao hiem", "du phong nghiep vu"],
    "phai_tra_nguoi_ban":         ["phai tra nguoi ban", "accounts payable"],
    "tong_no_phai_tra":           ["tong no phai tra", "total liabilities"],
    "von_dieu_le":                ["von dieu le", "charter capital"],
    "loi_nhuan_chua_phan_phoi":   ["loi nhuan chua phan phoi", "retained earnings"],
    "tong_von_chu_so_huu":        ["tong von chu so huu", "total equity"],
    "tong_nguon_von":             ["tong nguon von", "total liabilities and equity"],
    "doanh_thu_phi_bao_hiem_goc": ["doanh thu phi bao hiem goc", "gross premium revenue", "phi bao hiem goc", "gross written premium"],
    "phi_tai_bao_hiem":           ["phi tai bao hiem", "reinsurance premium"],
    "doanh_thu_phi_bao_hiem_thuan": ["doanh thu phi bao hiem giu lai", "net premium revenue", "phi bao hiem thuan", "net written premium"],
    "chi_boi_thuong":             ["chi boi thuong bao hiem", "claims paid", "chi tra boi thuong", "chi phi boi thuong", "boi thuong bao hiem"],
    "chi_phi_khai_thac":          ["chi phi khai thac bao hiem", "acquisition costs"],
    "chi_phi_quan_ly":            ["chi phi quan ly", "management expenses"],
    "doanh_thu_hoat_dong_tai_chinh": ["doanh thu hoat dong tai chinh", "financial income"],
    "loi_nhuan_hoat_dong_bao_hiem": ["loi nhuan hoat dong kinh doanh bao hiem", "underwriting profit"],
    "loi_nhuan_truoc_thue":       ["loi nhuan truoc thue", "profit before tax"],
    "chi_phi_thue_tndn":          ["chi phi thue thu nhap doanh nghiep", "income tax expense"],
    "loi_nhuan_sau_thue":         ["loi nhuan sau thue", "net profit"],
    "eps_co_ban":                 ["lai co ban tren co phieu", "basic eps"],
    "lctt_thuan_hdkd":            ["luu chuyen tien thuan tu hoat dong kinh doanh"],
    "lctt_thuan_hddt":            ["luu chuyen tien thuan tu hoat dong dau tu"],
    "lctt_thuan_hdtc":            ["luu chuyen tien thuan tu hoat dong tai chinh"],
    "tien_dau_ky":                ["tien va tuong duong tien dau ky"],
    "tien_cuoi_ky":               ["tien va tuong duong tien cuoi ky"],
}


# ==============================================================================
# BUILD INDEX
# ==============================================================================

ALL_MAPS = {
    "corporate":  CORPORATE_MAP,
    "bank":       BANK_MAP,
    "securities": SECURITIES_MAP,
    "insurance":  INSURANCE_MAP,
}

_INDEX: dict[str, dict[str, str]] = {}
for _ctype, _cmap in ALL_MAPS.items():
    _INDEX[_ctype] = {}
    for _slug, _kws in _cmap.items():
        for _kw in _kws:
            _INDEX[_ctype][_norm(_kw)] = _slug


# ==============================================================================
# MAIN LOOKUP
# ==============================================================================

def map_to_canonical(
    item_name: str,
    company_type: str = "corporate",
) -> str | None:
    """
    Tim slug canonical. Tra ve None neu:
    - item_name la rac hoan toan (sau _preprocess -> rong)
    - Khong tim thay keyword match nao

    Thu tu: exact -> substring -> reverse-substring -> thu voi ten goc
    """
    idx = _INDEX.get(company_type, _INDEX["corporate"])

    # Pass 1: ten sau pre-processing
    clean = _preprocess(item_name)
    if not clean:
        return None  # rac hoan toan

    n = _norm(clean)
    if n:
        if n in idx:
            return idx[n]
        for kw, slug in idx.items():
            if kw in n:
                return slug
        if len(n) >= 10:
            for kw, slug in idx.items():
                if n in kw:
                    return slug

    # Pass 2: ten goc neu khac sau preprocess
    if clean != item_name:
        n_raw = _norm(item_name)
        if n_raw and n_raw != n:
            if n_raw in idx:
                return idx[n_raw]
            for kw, slug in idx.items():
                if kw in n_raw:
                    return slug
            if len(n_raw) >= 10:
                for kw, slug in idx.items():
                    if n_raw in kw:
                        return slug

    return None


def get_statement_for_slug(slug: str, company_type: str = "corporate") -> str | None:
    """Xac dinh slug thuoc CDKT | KQKD | LCTT."""
    from Database.models_new import (
        CORPORATE_CDKT, CORPORATE_KQKD, CORPORATE_LCTT,
        BANK_CDKT,       BANK_KQKD,      BANK_LCTT,
        SECURITIES_CDKT, SECURITIES_KQKD, SECURITIES_LCTT,
        INSURANCE_CDKT,  INSURANCE_KQKD,  INSURANCE_LCTT,
    )
    _sm = {
        "corporate":  (CORPORATE_CDKT,  CORPORATE_KQKD,  CORPORATE_LCTT),
        "bank":       (BANK_CDKT,       BANK_KQKD,       BANK_LCTT),
        "securities": (SECURITIES_CDKT, SECURITIES_KQKD, SECURITIES_LCTT),
        "insurance":  (INSURANCE_CDKT,  INSURANCE_KQKD,  INSURANCE_LCTT),
    }
    cdkt, kqkd, lctt = _sm.get(company_type, _sm["corporate"])
    if slug in cdkt: return "CDKT"
    if slug in kqkd: return "KQKD"
    if slug in lctt: return "LCTT"
    return None