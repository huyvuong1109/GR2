# -*- coding: utf-8 -*-
"""
canonical_map.py - Map ten chi tieu OCR/LLM -> slug chuan.
"""

import re
import unicodedata


def _norm(text: str) -> str:
    text = (text or "").replace("Đ", "D").replace("đ", "d").replace("Đ", "d")
    nfkd = unicodedata.normalize("NFKD", text or "")
    t = "".join(c for c in nfkd if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-zA-Z0-9\s]", " ", t).lower()
    return re.sub(r"\s+", " ", t).strip()


_GARBAGE_RE = re.compile(
    r"^[A-Z\s,\.\!\?\|&#;0-9/\\]+$"
    r"|^[\W\d\s]{0,5}$"
)
_PREFIX_JUNK_RE     = re.compile(r"^(?:&#\d+;|[|Ì Í§¦_]+|[IVXivx]{1,4}\.)\s*")
_TRONG_PREFIX_RE    = re.compile(r"^Trong\s*[-–]\s*", flags=re.IGNORECASE)
_LEADING_DASH_RE    = re.compile(r"^\s*[-–]\s*")
_SLASH_VARIANT_RE   = re.compile(r"\s*/\s*\([^)]{1,10}\)", flags=re.IGNORECASE)
_SO_DU_RE = re.compile(r"^s[oố]\s*d[uư]\s*(cu[oố]i|d[aầ]u)\s*k[yỳ]", flags=re.IGNORECASE)
_ORDER_PREFIX_RE    = re.compile(
    r"^(?:[0-9]{1,3}[\.\)\-]\s+|[IVXivx]{1,4}[\.\)\-]\s+|[A-Da-d][\.\)]\s+|[a-z]{1,2}\.\s+)"
)
_SUB_ORDER_RE       = re.compile(r"^[0-9]+[,\.][0-9]*\s+")
_FORMULA_RE         = re.compile(r"\{[^}]*\}")
_PAREN_CODE_RE      = re.compile(r"\(\s*\d+\s*\)")
_PAREN_UNIT_RE      = re.compile(r"\(\s*(?:trieu|ty|nghin|dong|vnd|usd)\s*(?:dong)?\s*\)", flags=re.IGNORECASE)
_PAREN_PCT_RE       = re.compile(r"\s*\(%\)\s*$")
_PAREN_MDON_RE      = re.compile(r"\s*\(trieu dong\)\s*$", flags=re.IGNORECASE)
_THUYET_MINH_RE     = re.compile(r"thuyet\s*minh\s*\d*", flags=re.IGNORECASE)
_TRAILING_STAR_RE   = re.compile(r"\s*\(\s*\*+\s*\)\s*$")
_TRAILING_NOISE_RE  = re.compile(r"\s+(?:nay|truoc|cuoi ky|dau ky)\s*$", flags=re.IGNORECASE)
_DONG_SUFFIX_RE     = re.compile(r"\s*\(dong\)\s*$", flags=re.IGNORECASE)


def _preprocess(name: str) -> str:
    t = name.strip()
    if not t:
        return ""
    if _GARBAGE_RE.match(t) and len(t) < 30:
        return ""
    t = re.sub(r"^&#\d+;\s*", "", t).strip()
    # Bo prefix "Trong - ", "- "
    t = _TRONG_PREFIX_RE.sub("", t).strip()
    t = _LEADING_DASH_RE.sub("", t).strip()
    t = _PREFIX_JUNK_RE.sub("", t).strip()
    # Bo "/(lỗ)", "/(Lỗ)", "/(lãi)" -> giu phan truoc
    t = _SLASH_VARIANT_RE.sub("", t).strip()
    for _ in range(2):
        t = _ORDER_PREFIX_RE.sub("", t).strip()
    t = _SUB_ORDER_RE.sub("", t).strip()
    t = _FORMULA_RE.sub("", t).strip()
    t = _TRAILING_STAR_RE.sub("", t).strip()
    t = _PAREN_CODE_RE.sub("", t)
    t = _PAREN_UNIT_RE.sub("", t)
    t = _PAREN_PCT_RE.sub("", t)
    t = _PAREN_MDON_RE.sub("", t)
    t = _THUYET_MINH_RE.sub("", t)
    t = _DONG_SUFFIX_RE.sub("", t)
    t = _TRAILING_NOISE_RE.sub("", t)
    t = re.sub(r"\s+", " ", t).strip()
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
        "tien va tuong duong tien",
    ],
    "dau_tu_tai_chinh_ngan_han": [
        "dau tu tai chinh ngan han", "chung khoan kinh doanh ngan han",
        "short term investments", "dau tu ngan han",
        "cac khoan dau tu tai chinh ngan han",
        "dau tu nam giu den ngay dao han ngan han",
        "dau tu nam giu den ngay dao han",
        "gia tri thuan dau tu ngan han",
        "cac khoan dau tu tai chinh ngan han",   # "II. Các khoản đầu tư tài chính ngắn hạn"
        "dau tu nam giu den ngay dao han",        # [15x] + [6x] + [5x] variants
        "giam chung khoan kinh doanh",           # [6x] "Giảm chứng khoán kinh doanh"
        "du phong giam gia dau tu ngan han", 
    ],
    "phai_thu_ngan_han_khach_hang": [
        "phai thu ngan han cua khach hang", "phai thu khach hang",
        "accounts receivable", "phai thu ngan han khach",
        "phai thu khach hang ngan han",
        "cac khoan phai thu ngan han",
    ],
    "phai_thu_ngan_han_khac": [
        "phai thu ngan han khac", "other receivables",
        "phai thu ve cho vay ngan han",
        "du thu",
        "phong phai ngan han kho doi",
        "chi phi tra truoc ngan han",
        "thue gtgt duoc khau tru",
        "thue va cac khoan khac phai thu",
        "thue va cac khoan khac phai thu nha nuoc",
        "phai thu ngan han kho doi",
        "du phong phai thu ngan han kho doi",
        "du phong phai thu ngan han kho doi",    # [11x]+[8x] "Dự phòng phải thu ngắn hạn khó đòi"
        "cac khoan phai thu khac",               # [9x] "4. Các khoản phải thu khác"
        "thue gtgt duoc khau tru",               # [10x]+[4x]
        "tai san thieu cho xu ly",               # [7x] "6. Tài sản thiếu chờ xử lý"
        "tam ung giai phong mat bang",           # [4x]
    ],
    "hang_ton_kho": [
        "hang ton kho", "inventories", "ton kho",
        "hang ton kho rong",
        "chi phi san xuat kinh doanh do dang",
    ],
    "tai_san_ngan_han_khac": [
        "tai san ngan han khac", "other current assets",
        "tai san luu dong khac",
    ],
    "tong_tai_san_ngan_han": [
        "tong tai san ngan han", "total current assets", "a tong cong",
        "tai san ngan han",
    ],
    "phai_thu_dai_han": [
        "phai thu dai han",
        "phai thu ve cho vay dai han",
        "phai thu dai han khac",
        "long term receivables",
        "tra truoc cho nguoi ban dai han",
        "tra truoc dai han",
        "phai thu dai han cua khach hang",
    ],
    "tai_san_co_dinh_huu_hinh": [
        "tai san co dinh huu hinh", "property plant equipment",
        "tai san co dinh net", "tscd huu hinh",
        "tai san co dinh",
        "tai san co dinh",          # OCR lỗi "có" thay "cố"
        "nguyen gia", "nguyen gia tai san co dinh",
        "gia tri hao mon luy ke", "hao mon luy ke",
        "tai san co dinh huu hinh",              # [9x]+[4x] với prefix số
        "tai san co dinh thue tai chinh",        # [5x] "2. Tài sản cố định thuê tài chính"
        "tai san co dinh",                       # "II. Tài sản cố định" [4x]
    ],
    "tai_san_co_dinh_vo_hinh": [
        "tai san co dinh vo hinh", "intangible assets",
        "loi the thuong mai",       # đôi khi OCR nhầm vị trí
    ],
    "bat_dong_san_dau_tu": [
        "bat dong san dau tu", "investment properties",
    ],
    "tai_san_co_dinh_xay_dung_do_dang": [
        "tai san xay dung co ban do dang", "construction in progress",
        "tai san do dang dai han", "xay dung co ban do dang",
    ],
    "dau_tu_tai_chinh_dai_han": [
        "dau tu tai chinh dai han", "long term investments",
        "dau tu vao cong ty con", "dau tu vao cong ty lien ket",
        "cac khoan dau tu tai chinh dai han",
        "dau tu vao cong ty lien doanh lien ket",
        "dau tu dai han khac",
        "du phong giam gia dau tu tai chinh dai han",
        "dau tu dai han",
        "dau tu vao cac doanh nghiep khac",
        "dau tu gop von vao don vi khac",   # "Đầu tư góp vốn vào đơn vị khác"
        "du phong dau tu tai chinh dai han",
        "dau tu nam giu den ngay dao han",  # dài hạn version
        "cac khoan dau tu tai chinh dai han",    # [6x] "V. Các khoản đầu tư tài chính dài hạn"
        "dau tu vao cong ty lien ket lien doanh", # [7x] "2. Đầu tư vào công ty liên kết, liên doanh"
        "du phong giam gia dau tu tai chinh dai han", # [7x]+[6x]
        "dau tu gop von vao don vi khac",        # [4x]
    ],
    "loi_the_thuong_mai": [
        "loi the thuong mai",
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
        "tai san dai han",
    ],
    "tong_tai_san": [
        "tong cong tai san", "tong tai san", "total assets",
        "tong cong tai san a b",
    ],
    "vay_ngan_han": [
        "vay va no thue tai chinh ngan han", "vay ngan han",
        "short term borrowings", "vay ngan han va dai han den han tra",
        "trai phieu chuyen doi",
    ],
    "phai_tra_nguoi_ban_ngan_han": [
        "phai tra nguoi ban ngan han", "accounts payable",
        "phai tra nha cung cap", "phai tra nguoi ban",
        "tra truoc cho nguoi ban ngan han",
    ],
    "nguoi_mua_tra_tien_truoc_ngan_han": [
        "nguoi mua tra tien truoc ngan han", "advance from customers",
    ],
    "thue_va_cac_khoan_phai_nop": [
        "thue va cac khoan phai nop nha nuoc", "taxes payable",
    ],
    "phai_tra_nguoi_lao_dong": [
        "phai tra nguoi lao dong", "payables to employees",
    ],
    "chi_phi_phai_tra_ngan_han": [
        "chi phi phai tra ngan han", "accrued liabilities",
    ],
    "chi_phi_phai_tra_dai_han": [               # slug mới cần thêm vào CORPORATE_SLUGS
        "chi phi phai tra dai han",              # [4x] "Chỉ phí phải trả dài hạn" (OCR lỗi)
        "chi phi phai tra dai han",
    ],
    "du_phong_phai_tra_ngan_han": [
        "du phong phai tra ngan han",
        "du phong phai ngan han",
    ],
    "phai_tra_ngan_han_khac": [
        "phai tra ngan han khac", "other current liabilities",
    ],
    "tong_no_ngan_han": [
        "tong no ngan han", "total current liabilities", "no ngan han",
    ],
    "vay_dai_han": [
        "vay va no thue tai chinh dai han", "vay dai han", "long term borrowings",
    ],
    "thue_thu_nhap_hoan_lai_phai_tra": [
        "thue thu nhap hoan lai phai tra", "deferred tax liability",
    ],
    "du_phong_phai_tra_dai_han": [
        "du phong phai tra dai han",
    ],
    "phai_tra_dai_han_khac": [
        "phai tra dai han khac", "other non current liabilities",
    ],
    "tong_no_dai_han": [
        "tong no dai han", "total non current liabilities", "no dai han",
    ],
    "tong_no_phai_tra": [
        "tong no phai tra", "total liabilities", "tong cong no phai tra",
        "no phai tra",
        "tong cong", 
    ],
    "von_gop_cua_chu_so_huu": [
        "von gop cua chu so huu", "von dieu le", "charter capital",
        "share capital", "co phan pho thong",
        "von dau tu cua chu so huu",
        "co phieu pho thong",
        "von va cac quy",
        "von ngan sach nha nuoc va quy khac",
    ],
    "thang_du_von_co_phan": [
        "thang du von co phan", "share premium", "von khac cua chu so huu",
    ],
    "co_phieu_quy":         ["co phieu quy", "treasury shares"],
    "co_phieu_uu_dai":      ["co phieu uu dai", "preferred shares"],
    "quy_dau_tu_phat_trien": [
        "quy dau tu phat trien", "development fund",
        "quy dau tu va phat trien",
    ],
    "quy_khen_thuong_phuc_loi": ["quy khen thuong phuc loi", "bonus welfare fund"],
    "chenh_lech_ty_gia_hoi_doai_vcsh": [
        "chenh lech ty gia hoi doai",
        "anh huong cua chenh lech ty gia",
    ],
    "loi_ich_co_dong_khong_kiem_soat": [
        "loi ich cua co dong khong kiem soat",
        "loi ich cua co dong thieu so",
        "non controlling interest", "minority interest",
        "loi ich co dong thieu so",
        "loi ich cua co dong co dong khong kiem soat",  # OCR lỗi "cỗ"
        "loi ich cua co dong thieu so",
    ],
    "loi_nhuan_sau_thue_chua_phan_phoi": [
        "loi nhuan sau thue chua phan phoi", "retained earnings",
        "loi nhuan chua phan phoi",
        "lnst chua phan phoi luy ke den cuoi ky",
        "lnst chua phan phoi",
        "phan phoi luy ke den cuoi ky",
        "lnst chua phan phoi luy ke",
        "lai chua phan phoi",
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
        "doanh thu thuan ve ban hang", "net revenue from sales",
        "doanh thu",
        "n ban hang va cung",
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
        "lai gop",
    ],
    "doanh_thu_hoat_dong_tai_chinh": [
        "doanh thu hoat dong tai chinh", "financial income",
        "thu nhap tai chinh",
        "thu nhap lai",
        "thu lai va co tuc",
    ],
    "chi_phi_tai_chinh": [
        "chi phi tai chinh", "financial expenses", "chi phi lai vay",
        "chi phi tien lai vay",
        "chi phi lai va cac khoan tuong tu",  # bank-style nhưng đôi khi xuất hiện ở corporate
    ],
    "phan_lai_lo_trong_cong_ty_lien_doanh": [
        "phan lai lo trong cong ty lien doanh lien ket",
        "share of profit loss in associates",
        "phan lai lo trong cong ty lien doanh",
        "lai lo trong cong ty lien doanh",
        "lai lo tu cong ty lien doanh",
        "phan lo trong cong ty lien doanh lien ket",  # "Phần lỗ trong..."
        "phan lo trong cong ty lien doanh",
        "phan lai trong cong ty lien doanh",
    ],
    "chi_phi_ban_hang": [
        "chi phi ban hang", "selling expenses",
    ],
    "chi_phi_quan_ly_dn": [
        "chi phi quan ly doanh nghiep", "general and administrative",
        "chi phi quan ly dn",
    ],
    "loi_nhuan_thuan_hdkd": [
        "loi nhuan thuan tu hoat dong kinh doanh", "operating profit",
        "loi nhuan hoat dong", "ebit",
        "loi nhuan tu hoat dong kinh doanh",
        "lai lo tu hoat dong kinh doanh",
        "lai lo rong truoc thue",
        "loi nhuan tu hoat dong kinh doanh",     # [14x]+[5x] kể cả variant có/không formula
        "loi nhuan tu hdkd",
        "loi nhuan tu hoat dong kinh doanh 30 20 21 22 24 25", # Công thức bị dính
        "loi tu hoat dong kinh doanh",                         # "Lợi từ..."
        "loi nhuan tu hoat dong kinh doanh",
    ],
    "thu_nhap_khac": [
        "thu nhap khac", "other income",
        "thu nhap chi phi khac",
    ],
    "chi_phi_khac": ["chi phi khac", "other expenses"],
    "loi_nhuan_khac": [
        "loi nhuan khac", "other profit",
        "lai lo tu hoat dong dau tu",
        "lai lo tu thanh ly tai san co dinh",
        "lai lo khac",              # "Lãi/(lỗ) khác" sau khi bỏ "/(lỗ)"
        "lai khac",
        "lai tu hoat dong dau tu",
    ],
    "loi_nhuan_truoc_thue": [
        "tong loi nhuan ke toan truoc thue", "profit before tax",
        "loi nhuan truoc thue", "earnings before tax", "ebt",
        "ln truoc thue",
    ],
    "chi_phi_thue_tndn_hien_hanh": [
        "chi phi thue thu nhap doanh nghiep hien hanh",
        "chi phi thue tndn hien hanh",
        "chi phi tndn hien hanh",
    ],
    "chi_phi_thue_tndn_hoan_lai": [
        "chi phi thue thu nhap doanh nghiep hoan lai",
        "chi phi thue tndn hoan lai",
    ],
    "chi_phi_thue_tndn": [
        "chi phi thue thu nhap doanh nghiep", "income tax expense",
        "thue tndn",
        "chi phi thue tndn hien hanh",
        "chi phi thue tndn hoan lai",
    ],
    "loi_nhuan_sau_thue": [
        "loi nhuan sau thue thu nhap doanh nghiep", "profit after tax",
        "net profit", "loi nhuan sau thue", "net income",
        "loi nhuan thuan",
        "loi nhuan lo sau thue",        # "Lợi nhuận/(lỗ) sau thuế" sau preprocess
    ],
    "loi_nhuan_cua_co_dong_khong_kiem_soat": [
        "loi ich cua co dong khong kiem soat kqkd",
        "loi nhuan cua co dong thieu so",
        "loi ich cua co dong thieu so",
        "co dong thieu so",
        "loi nhuan lo sau thue cua co dong khong kiem soat",
    ],
    "loi_nhuan_cua_co_dong_ct_me": [
        "loi nhuan cua co dong cong ty me", "profit attributable to parent",
        "lnst cua co dong cong ty me",
        "loi nhuan sau thue cua co dong cong ty me",
        "co dong cua cong ty me",
        "loi nhuan lo sau thue cua cong ty me",   # "Lợi nhuận/(lỗ) sau thuế của công ty mẹ"
        "trong loi nhuan lo sau thue cua cong ty me",
        "loi nhueu sau thue cua so dong cong ty me",
    ],
    "eps_co_ban": [
        "lai co ban tren co phieu", "basic eps",
    ],

    # ── LCTT ──────────────────────────────────────────────────────────────────
    "lctt_truoc_thay_doi_von_luu_dong": [
        "luu chuyen tien thuan tu hoat dong kinh doanh truoc",
        "luu chuyen tien thuan tu hdkd truoc thay doi von luu dong",
        "luu chuyen tien te rong tu cac hoat dong sxkd",
    ],
    "khau_hao_tscd": [
        "khau hao tscd",
        "khau hao tai san co dinh",
        "chi phi khau hao",
    ],
    "du_phong_rui_ro_tin_dung": [
        "du phong rr tin dung",
        "du phong rui ro tin dung",
    ],
    "lai_lo_chenh_lech_ty_gia_chua_thuc_hien": [
        "lai lo chenh lech ty gia chua thuc hien",
    ],
    "thay_doi_khoan_phai_thu": [
        "tang giam cac khoan phai thu", "change in receivables",
    ],
    "thay_doi_hang_ton_kho": [
        "tang giam hang ton kho", "change in inventories",
    ],
    "thay_doi_khoan_phai_tra": [
        "tang giam cac khoan phai tra", "change in payables",
    ],
    "thay_doi_chi_phi_tra_truoc": [
        "tang giam chi phi tra truoc",
    ],
    "anh_huong_ty_gia_hoi_doai": [
        "anh huong cua thay doi ty gia hoi doai quy doi ngoai te",
        "effect of exchange rate changes",
        "anh huong cua chenh lech ty gia",
        "anh huong c cua luu doi ty gia",
    ],
    "lctt_thuan_hdkd": [
        "luu chuyen tien thuan tu hoat dong kinh doanh",
        "net cash from operating activities", "cfo",
    ],
    "tien_mua_tai_san_co_dinh": [
        "tien chi de mua sam tai san co dinh", "purchase of fixed assets",
        "mua sam tscd",
    ],
    "tien_thu_thanh_ly_tscdd": [
        "tien thu tu thanh ly nhuong ban tai san co dinh",
        "tien thu duoc tu thanh ly tai san co dinh",
    ],
    "tien_chi_dau_tu_gop_von": [
        "tien chi dau tu gop von vao don vi khac",
        "tien chi cho vay mua cong cu no cua don vi khac",
    ],
    "tien_thu_dau_tu_gop_von": [
        "tien thu hoi dau tu gop von vao don vi khac",
        "tien thu hoi cho vay ban lai cac cong cu no cua don vi khac",
        "tien thu tu viec ban cac khoan dau tu vao doanh nghiep khac",
    ],
    "lctt_thuan_hddt": [
        "luu chuyen tien thuan tu hoat dong dau tu",
        "net cash from investing activities", "cfi",
        "luu chuyen tu hoat dong dau tu",
    ],
    "tien_thu_vay": [
        "tien thu tu di vay", "proceeds from borrowings",
        "tien thu duoc cac khoan di vay",
    ],
    "tien_tra_no_vay": [
        "tien tra no goc vay", "repayment of borrowings",
        "tien tra cac khoan di vay",
        "tien thanh toan von goc di thue tai chinh",
        "chi tra cho viec mua lai tra co phieu",
        "chi phi lai vay da tra",       # "Chi phí lãi vay đã trả"
    ],
    "co_tuc_da_tra": [
        "co tuc loi nhuan da tra cho chu so huu", "dividends paid",
        "co tuc da tra",
        "co tuc loi nhuan da tra",
        "co tuc loi nhuan da tra cho co dong khong kiem soat",  # [5x] "cỗ đông"
    ],
    "tien_thu_tu_phat_hanh_co_phieu": [
        "tang von co phan tu gop von va hoac phat hanh co phieu",
        "tien thu tu phat hanh co phieu",
    ],
    "tien_thu_thue_tndn_da_nop": [
        "tien thu nhap doanh nghiep da tra",
        "thue thu nhap doanh nghiep da nop", 
    ],
    "tien_thu_khac_hdkd": [
        "tien thu khac tu cac hoat dong kinh doanh",
    ],
    "tien_chi_khac_hdkd": [
        "tien chi khac tu cac hoat dong kinh doanh",
    ],
    "tien_thu_co_tuc": [
        "tien thu co tuc va loi nhuan duoc chia",
        "co tuc da nhan",
        "thu lai va co tuc",
    ],
    "lctt_thuan_hdtc": [
        "luu chuyen tien thuan tu hoat dong tai chinh",
        "net cash from financing activities", "cff",
        "luu chuyen tien tu hoat dong tai chinh",
    ],
    "tien_dau_ky":  ["tien va tuong duong tien dau ky", "so du dau ky", "cash at beginning"],
    "tien_cuoi_ky": ["tien va tuong duong tien cuoi ky", "so du cuoi ky", "cash at end"],

    "tang_truong_doanh_thu": ["tang truong doanh thu"],
    "tang_truong_loi_nhuan": ["tang truong loi nhuan"],
}


# ==============================================================================
# BANK MAP
# ==============================================================================

BANK_MAP: dict[str, list[str]] = {
    "tien_mat_vang_bac_da_quy":   ["tien mat vang bac da quy", "cash gold silver"],
    "tien_gui_tai_nhnn": [
        "tien gui tai ngan hang nha nuoc", "deposits at sbv",
        "tien gui tai ngan hang nha nuoc viet nam",
    ],
    "tien_gui_cho_vay_cac_tctd": [
        "tien gui va cho vay cac to chuc tin dung", "due from banks",
        "tien gui tai cac tctd khac va cho vay cac tctd khac",
    ],
    "chung_khoan_kinh_doanh": [
        "trading securities",
        "du phong giam gia chung khoan kinh doanh",
    ],
    "cho_vay_khach_hang": [
        "cho vay khach hang", "gross loans", "du no cho vay khach hang",
        "cho vay va ung truoc khach hang", "cho vay", "du no cho vay",
    ],
    "du_phong_rui_ro_cho_vay": [
        "du phong rui ro cho vay khach hang", "provision for loans",
        "du phong cu the va chung", "trich lap du phong rui ro",
    ],
    "chung_khoan_dau_tu": [
        "chung khoan dau tu", "investment securities",
        "chung khoan dau tu giu den ngay dao han",
        "chung khoan dau tu san sang de ban",
        "du phong giam gia chung khoan dau tu",
    ],
    "cac_cong_cu_tai_chinh_phai_sinh": [
        "cac cong cu tai chinh phai sinh va khoan no tai chinh khac",
    ],
    "gop_von_dau_tu_dai_han": [
        "gop von dau tu dai han", "long term investments",
        "dau tu vao cac doanh nghiep khac",
        "dau tu vao cong ty con",
        "dau tu vao cong ty lien doanh",
        "du phong giam gia dau tu dai han",
        "gia tri rong tai san dau tu",
    ],
    "tai_san_co_dinh": [
        "tai san co dinh", "fixed assets",
        "tai san co dinh huu hinh",
        "tai san co dinh vo hinh",
        "tai san co dinh thue tai chinh",
        "mua sam tscd",
    ],
    "tai_san_co":       ["tai san co khac", "other assets"],
    "tong_tai_san":     ["tong tai san", "total assets", "tong cong tai san"],
    "cac_khoan_no_chinh_phu_nhnn": [
        "cac khoan no chinh phu va ngan hang nha nuoc",
        "cac khoan no chinh phu nhnn",
        "von tai tro uy thac dau tu cua cp va cac to chuc td khac",
    ],
    "tien_gui_vay_cac_tctd": [
        "tien gui va vay cac to chuc tin dung", "due to banks",
        "tien gui va vay cac tctd khac",
    ],
    "tien_gui_khach_hang": [
        "tien gui cua khach hang", "customer deposits",
        "nhan tien gui cua khach hang", "tien gui khach hang", "huy dong von",
    ],
    "phat_hanh_giay_to_co_gia":   ["phat hanh giay to co gia"],
    "cac_khoan_no_khac":          ["cac khoan no khac", "other liabilities"],
    "tong_no_phai_tra":           ["tong no phai tra", "total liabilities", "no phai tra"],
    "von_dieu_le": [
        "von dieu le", "charter capital", "share capital",
        "von cua to chuc tin dung",
        "von gop cua chu so huu",
    ],
    "thang_du_von":     ["thang du von co phan", "share premium"],
    "quy_du_tru": [
        "quy du tru", "reserve fund",
        "quy cua to chuc tin dung",
        "cac quy khac",
    ],
    "loi_nhuan_chua_phan_phoi": [
        "loi nhuan chua phan phoi", "retained earnings",
        "loi nhuan sau thue chua phan phoi",
        "lai chua phan phoi",
    ],
    "tong_von_chu_so_huu":  ["tong von chu so huu", "total equity", "von chu so huu"],
    "tong_nguon_von":       ["tong nguon von", "tong cong nguon von", "total liabilities and equity"],
    # NPL
    "no_nhom_1":  ["no nhom 1", "no du tieu chuan", "nhom 1", "standard"],
    "no_nhom_2":  ["no nhom 2", "no can chu y", "nhom 2", "watch"],
    "no_nhom_3":  ["no nhom 3", "no duoi tieu chuan", "nhom 3", "substandard"],
    "no_nhom_4":  ["no nhom 4", "no nghi ngo", "nhom 4", "doubtful"],
    "no_nhom_5":  ["no nhom 5", "no co kha nang mat von", "nhom 5", "loss", "no mat von"],
    # KQKD
    "thu_nhap_lai_va_tuong_tu": [
        "thu nhap lai va cac khoan thu nhap tuong tu",
        "thu nhap lai va cac khoan tuong tu",
        "interest and similar income",
    ],
    "chi_phi_lai_va_tuong_tu": [
        "chi phi lai va cac khoan chi phi tuong tu",
        "chi phi lai va cac khoan tuong tu",
        "interest and similar expenses",
    ],
    "thu_nhap_tu_dich_vu": [               # THÊM MỚI
        "thu nhap tu hoat dong dich vu",
        "income from service activities",
    ],
    "chi_phi_dich_vu": [                   # THÊM MỚI
        "chi phi hoat dong dich vu",
        "service activity expenses",
    ],
    "thu_nhap_lai_thuan": [
        "thu nhap lai thuan", "net interest income", "nii",        
    ],
    "chi_phi_lai":  ["chi phi lai va cac khoan tuong tu"],
    "lai_thuan_tu_dich_vu": [
        "lai thuan tu hoat dong dich vu", "net fee income",
        "lai thuan tu dich vu",
    ],
    "lai_thuan_ngoai_hoi": [
        "lai thuan tu kinh doanh ngoai hoi va vang", "net forex gain",
        "kinh doanh ngoai hoi va vang",
        "lo thuan tu hoat dong kinh doanh ngoai hoi",
        "lo thuan tu kinh doanh ngoai hoi", 
    ],
    "lai_thuan_chung_khoan": [
        "lai thuan tu mua ban chung khoan kinh doanh", "net trading gain", "lai thuan tu mua ban chung khoan", "thuan tu mua ban chung khoan kinh doanh", 
    ],
    "lai_thuan_mua_ban_chung_khoan_dau_tu": [
        "lai thuan tu mua ban chung khoan dau tu",
    ],
    "thu_nhap_khac": [
        "thu nhap hoat dong khac", "thu nhap khac", "other income",
        "hoat dong khac",
        "lai lo cac hoat dong khac",
        "lai lo thuan tu hoat dong khac",  # "Lãi/lỗ thuần từ hoạt động khác"
    ],
    "tong_thu_nhap_hoat_dong": [
        "tong thu nhap hoat dong", "total operating income",
        "tong thu nhap truoc du phong", "tong thu nhap",
    ],
    "chi_phi_hoat_dong": [
        "chi phi hoat dong", "operating expenses", "opex",
        "tong chi phi hoat dong",
        "chi phi hoat dong khac",       # "Chi phí hoạt động khác"
        "chi phi quan ly dn",
    ],
    "loi_nhuan_thuan_truoc_du_phong": [
        "loi nhuan thuan tu hoat dong kinh doanh truoc chi phi du phong",
        "net profit before provision", "loi nhuan truoc du phong",
        "ln tu hdkd truoc cf du phong",
        "lai thuan tu hoat dong kinh doanh truoc chi phi du phong",
        "lai thuan tu hoat dong kinh doanh truoc",  
        "lai thuan tu hoat dong kinh doanh truoc chi phi du phong rui ro tin dung",
    ],
    "chi_phi_du_phong_rui_ro": [
        "chi phi du phong rui ro tin dung", "provision expenses",
        "chi phi trich lap du phong",
        "chi phi du phong rui ro tin dung",
    ],
    "loi_nhuan_truoc_thue":     ["loi nhuan truoc thue", "profit before tax", "ln truoc thue"],
    "chi_phi_thue_tndn": [
        "chi phi thue thu nhap doanh nghiep", "income tax expense",
        "chi phi thue tndn hien hanh",
        "chi phi thue tndn hoan lai",
        "thue tndn",
    ],
    "loi_nhuan_sau_thue": [
        "loi nhuan sau thue", "profit after tax", "net profit",
        "loi nhuan thuan",
    ],
    "loi_nhuan_cua_co_dong_ct_me": [
        "loi nhuan cua co dong cong ty me",
        "loi nhuan sau thue cua co dong cong ty me",
        "co dong cua cong ty me",
    ],
    "loi_ich_co_dong_thieu_so_bank": [
        "co dong thieu so",
        "loi ich cua co dong thieu so",
    ],
    "eps_co_ban":   ["lai co ban tren co phieu", "basic eps"],
    # LCTT
    "lctt_thuan_hdkd": [
        "luu chuyen tien thuan tu hoat dong kinh doanh", "cfo",
        "luu chuyen tien thuan tu hdkd truoc thay doi von luu dong",
        "luu chuyen tien thuan tu hdkd truoc thue",
        "luu chuyen tien te rong tu cac hoat dong sxkd",
    ],
    "lctt_thuan_hddt": [
        "luu chuyen tien thuan tu hoat dong dau tu", "cfi",
        "luu chuyen tu hoat dong dau tu",
        "tien thu tu viec ban cac khoan dau tu vao doanh nghiep khac",
        "tien thu duoc tu thanh ly tai san co dinh",
        "tien thu co tuc va loi nhuan duoc chia",
    ],
    "lctt_thuan_hdtc": [
        "luu chuyen tien thuan tu hoat dong tai chinh", "cff",
        "luu chuyen tien tu hoat dong tai chinh",
        "tang von co phan tu gop von va hoac phat hanh co phieu",
    ],
    "tien_dau_ky":  ["tien va tuong duong tien dau ky", "cash at beginning"],
    "tien_cuoi_ky": [
        "tien va tuong duong tien cuoi ky", "cash at end",
        "tien va tuong duong tien",
    ],
    "chenh_lech_ty_gia_hoi_doai": [
        "chenh lech ty gia hoi doai",
        "anh huong cua chenh lech ty gia",
    ],
    "chenh_lech_danh_gia_lai_tai_san": ["chenh lech danh gia lai tai san"],
    "chi_tu_cac_quy_tctd":             ["chi tu cac quy cua tctd"],
}


# ==============================================================================
# SECURITIES MAP
# ==============================================================================

SECURITIES_MAP: dict[str, list[str]] = {
    "tien_va_tuong_duong_tien":   ["tien va cac khoan tuong duong tien", "cash and equivalents", "tien va tuong duong tien"],
    "fvtpl":                      ["chung khoan fvtpl", "fvtpl", "tai san tai chinh ghi nhan theo fvtpl"],
    "afs":                        ["chung khoan san sang de ban", "afs", "available for sale"],
    "htm":                        ["chung khoan giu den ngay dao han", "htm", "held to maturity"],
    "cho_vay_margin":             ["cho vay giao dich ky quy", "margin loans", "cho vay margin", "phai thu cho vay giao dich ky quy"],
    "phai_thu_khach_hang":        ["phai thu khach hang", "receivables from customers", "cac khoan phai thu ngan han"],
    "tai_san_ngan_han_khac":      ["tai san ngan han khac", "other current assets", "tai san luu dong khac"],
    "tong_tai_san_ngan_han":      ["tong tai san ngan han", "total current assets"],
    "tai_san_co_dinh":            ["tai san co dinh", "fixed assets"],
    "dau_tu_tai_chinh_dai_han":   ["dau tu tai chinh dai han", "long term investments", "dau tu dai han"],
    "tai_san_dai_han_khac":       ["tai san dai han khac", "other non current assets"],
    "tong_tai_san_dai_han":       ["tong tai san dai han", "total non current assets"],
    "tong_tai_san":               ["tong tai san", "total assets", "tong cong tai san"],
    "phai_tra_khach_hang":        ["phai tra khach hang", "tien cua nha dau tu", "payables to customers"],
    "vay_ngan_han":               ["vay ngan han", "short term borrowings", "vay va no thue tai chinh ngan han"],
    "tong_no_ngan_han":           ["tong no ngan han", "total current liabilities", "no ngan han"],
    "vay_dai_han":                ["vay dai han", "long term borrowings"],
    "tong_no_dai_han":            ["tong no dai han", "total non current liabilities"],
    "tong_no_phai_tra":           ["tong no phai tra", "total liabilities", "no phai tra"],
    "von_dieu_le":                ["von dieu le", "charter capital", "co phieu pho thong", "von gop cua chu so huu"],
    "thang_du_von":               ["thang du von co phan", "share premium"],
    "loi_nhuan_chua_phan_phoi":   ["loi nhuan chua phan phoi", "retained earnings", "lai chua phan phoi"],
    "tong_von_chu_so_huu":        ["tong von chu so huu", "total equity", "von chu so huu"],
    "tong_nguon_von":             ["tong nguon von", "total liabilities and equity", "tong cong nguon von"],
    "doanh_thu_moi_gioi":         ["doanh thu moi gioi chung khoan", "brokerage revenue", "phi moi gioi", "hoa hong moi gioi"],
    "doanh_thu_tu_van":           ["doanh thu tu van tai chinh", "advisory fees", "phi tu van"],
    "doanh_thu_ngan_hang_dau_tu": ["doanh thu ngan hang dau tu", "investment banking fees"],
    "lai_kinh_doanh_chung_khoan": ["lai tu mua ban chung khoan tu doanh", "proprietary trading gain"],
    "lai_cho_vay_margin":         ["lai tu cho vay giao dich ky quy", "interest from margin lending"],
    "doanh_thu_quan_ly_quy":      ["phi quan ly quy", "fund management fees"],
    "tong_doanh_thu_hoat_dong":   ["tong doanh thu hoat dong", "total operating revenue"],
    "chi_phi_hoat_dong":          ["chi phi hoat dong", "operating expenses", "chi phi quan ly dn"],
    "loi_nhuan_truoc_thue":       ["loi nhuan truoc thue", "profit before tax", "ln truoc thue"],
    "chi_phi_thue_tndn":          ["chi phi thue thu nhap doanh nghiep", "income tax expense", "chi phi thue tndn hien hanh", "chi phi thue tndn hoan lai"],
    "loi_nhuan_sau_thue":         ["loi nhuan sau thue", "net profit", "loi nhuan thuan"],
    "eps_co_ban":                 ["lai co ban tren co phieu", "basic eps"],
    "lctt_thuan_hdkd":            ["luu chuyen tien thuan tu hoat dong kinh doanh", "luu chuyen tien te rong tu cac hoat dong sxkd"],
    "lctt_thuan_hddt":            ["luu chuyen tien thuan tu hoat dong dau tu", "luu chuyen tu hoat dong dau tu"],
    "lctt_thuan_hdtc":            ["luu chuyen tien thuan tu hoat dong tai chinh", "luu chuyen tien tu hoat dong tai chinh"],
    "tien_dau_ky":                ["tien va tuong duong tien dau ky", "cash at beginning"],
    "tien_cuoi_ky":               ["tien va tuong duong tien cuoi ky", "cash at end"],
}


# ==============================================================================
# INSURANCE MAP
# ==============================================================================

INSURANCE_MAP: dict[str, list[str]] = {
    "tien_va_tuong_duong_tien":     ["tien va cac khoan tuong duong tien", "cash and equivalents", "tien va tuong duong tien"],
    "dau_tu_tai_chinh":             ["dau tu tai chinh", "financial investments"],
    "phai_thu_phi_bao_hiem":        ["phai thu phi bao hiem", "insurance premium receivables", "phai thu ve hoat dong bao hiem"],
    "tai_san_ngan_han_khac":        ["tai san ngan han khac", "other current assets"],
    "tong_tai_san_ngan_han":        ["tong tai san ngan han", "total current assets"],
    "tai_san_co_dinh":              ["tai san co dinh", "fixed assets"],
    "tai_san_dai_han_khac":         ["tai san dai han khac", "other non current assets"],
    "tong_tai_san_dai_han":         ["tong tai san dai han", "total non current assets"],
    "tong_tai_san":                 ["tong tai san", "total assets", "tong cong tai san"],
    "du_phong_nghiep_vu":           ["du phong nghiep vu bao hiem", "provision for insurance liabilities", "du phong nghiep vu"],
    "phai_tra_nguoi_ban":           ["phai tra nguoi ban", "accounts payable"],
    "tong_no_phai_tra":             ["tong no phai tra", "total liabilities", "no phai tra"],
    "von_dieu_le":                  ["von dieu le", "charter capital", "von gop cua chu so huu"],
    "loi_nhuan_chua_phan_phoi":     ["loi nhuan chua phan phoi", "retained earnings", "lai chua phan phoi"],
    "tong_von_chu_so_huu":          ["tong von chu so huu", "total equity", "von chu so huu"],
    "tong_nguon_von":               ["tong nguon von", "total liabilities and equity", "tong cong nguon von"],
    "doanh_thu_phi_bao_hiem_goc":   ["doanh thu phi bao hiem goc", "gross premium revenue", "phi bao hiem goc"],
    "phi_tai_bao_hiem":             ["phi tai bao hiem", "reinsurance premium"],
    "doanh_thu_phi_bao_hiem_thuan": ["doanh thu phi bao hiem giu lai", "net premium revenue", "phi bao hiem thuan"],
    "chi_boi_thuong":               ["chi boi thuong bao hiem", "claims paid", "chi tra boi thuong", "boi thuong bao hiem"],
    "chi_phi_khai_thac":            ["chi phi khai thac bao hiem", "acquisition costs"],
    "chi_phi_quan_ly":              ["chi phi quan ly", "management expenses"],
    "doanh_thu_hoat_dong_tai_chinh":  ["doanh thu hoat dong tai chinh", "financial income"],
    "loi_nhuan_hoat_dong_bao_hiem":   ["loi nhuan hoat dong kinh doanh bao hiem", "underwriting profit"],
    "loi_nhuan_truoc_thue":         ["loi nhuan truoc thue", "profit before tax", "ln truoc thue"],
    "chi_phi_thue_tndn":            ["chi phi thue thu nhap doanh nghiep", "income tax expense"],
    "loi_nhuan_sau_thue":           ["loi nhuan sau thue", "net profit", "loi nhuan thuan"],
    "eps_co_ban":                   ["lai co ban tren co phieu", "basic eps"],
    "lctt_thuan_hdkd":              ["luu chuyen tien thuan tu hoat dong kinh doanh"],
    "lctt_thuan_hddt":              ["luu chuyen tien thuan tu hoat dong dau tu"],
    "lctt_thuan_hdtc":              ["luu chuyen tien thuan tu hoat dong tai chinh"],
    "tien_dau_ky":                  ["tien va tuong duong tien dau ky"],
    "tien_cuoi_ky":                 ["tien va tuong duong tien cuoi ky"],
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

def map_to_canonical(item_name: str, company_type: str = "corporate") -> str | None:
    idx = _INDEX.get(company_type, _INDEX["corporate"])

    clean = _preprocess(item_name)
    if not clean:
        return None

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