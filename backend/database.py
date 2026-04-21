"""
Database Connection & Query Layer
Kết nối Database và truy vấn dữ liệu
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager
import pandas as pd
import sys
from pathlib import Path
from typing import Any

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from Database.models import (
    Company, BalanceSheet, IncomeStatement, CashFlow,
    Base, init_db
)
from Database.models_new import (
    BANK_CDKT,
    BANK_KQKD,
    BANK_LCTT,
    CORPORATE_CDKT,
    CORPORATE_KQKD,
    CORPORATE_LCTT,
    INSURANCE_CDKT,
    INSURANCE_KQKD,
    INSURANCE_LCTT,
    SECURITIES_CDKT,
    SECURITIES_KQKD,
    SECURITIES_LCTT,
)
from backend.config import DATABASE_URL


_COMPANY_TYPE_TABLE_MAP = {
    "corporate": "financials_corporate",
    "bank": "financials_bank",
    "insurance": "financials_insurance",
    "securities": "financials_securities",
}

_STATEMENT_SLUGS_BY_COMPANY_TYPE = {
    "corporate": {
        "balance_sheets": set(CORPORATE_CDKT),
        "income_statements": set(CORPORATE_KQKD),
        "cash_flows": set(CORPORATE_LCTT),
    },
    "bank": {
        "balance_sheets": set(BANK_CDKT),
        "income_statements": set(BANK_KQKD),
        "cash_flows": set(BANK_LCTT),
    },
    "insurance": {
        "balance_sheets": set(INSURANCE_CDKT),
        "income_statements": set(INSURANCE_KQKD),
        "cash_flows": set(INSURANCE_LCTT),
    },
    "securities": {
        "balance_sheets": set(SECURITIES_CDKT),
        "income_statements": set(SECURITIES_KQKD),
        "cash_flows": set(SECURITIES_LCTT),
    },
}

# Field mapper for report screens: source of truth slugs come from models_new.py
_BALANCE_FIELD_MAP = {
    "corporate": {
        "total_assets": "tong_tai_san",
        "current_assets": "tong_tai_san_ngan_han",
        "non_current_assets": "tong_tai_san_dai_han",
        "cash": "tien_va_tuong_duong_tien",
        "short_term_investments": "dau_tu_tai_chinh_ngan_han",
        "accounts_receivable": ("sum", ["phai_thu_ngan_han_khach_hang", "phai_thu_ngan_han_khac"]),
        "inventories": "hang_ton_kho",
        "total_liabilities": "tong_no_phai_tra",
        "current_liabilities": "tong_no_ngan_han",
        "non_current_liabilities": "tong_no_dai_han",
        "long_term_liabilities": "tong_no_dai_han",
        "short_term_debt": "vay_ngan_han",
        "long_term_debt": "vay_dai_han",
        "total_equity": "tong_von_chu_so_huu",
        "shareholders_equity": "tong_von_chu_so_huu",
        "charter_capital": "von_gop_cua_chu_so_huu",
        "retained_earnings": "loi_nhuan_sau_thue_chua_phan_phoi",
    },
    "bank": {
        "total_assets": "tong_tai_san",
        "current_assets": ("coalesce", ["tong_tai_san_ngan_han", "tong_tai_san"]),
        "non_current_assets": None,
        "cash": ("sum", ["tien_mat_vang_bac_da_quy", "tien_gui_tai_nhnn"]),
        "short_term_investments": "chung_khoan_kinh_doanh",
        "accounts_receivable": "cho_vay_khach_hang",
        "inventories": 0,
        "total_liabilities": "tong_no_phai_tra",
        "current_liabilities": "tong_no_phai_tra",
        "non_current_liabilities": None,
        "long_term_liabilities": None,
        "short_term_debt": "tien_gui_vay_cac_tctd",
        "long_term_debt": "cac_khoan_no_chinh_phu_nhnn",
        "total_equity": "tong_von_chu_so_huu",
        "shareholders_equity": "tong_von_chu_so_huu",
        "charter_capital": "von_dieu_le",
        "retained_earnings": "loi_nhuan_chua_phan_phoi",
    },
    "insurance": {
        "total_assets": "tong_tai_san",
        "current_assets": "tong_tai_san_ngan_han",
        "non_current_assets": "tong_tai_san_dai_han",
        "cash": "tien_va_tuong_duong_tien",
        "short_term_investments": "dau_tu_tai_chinh",
        "accounts_receivable": "phai_thu_phi_bao_hiem",
        "inventories": 0,
        "total_liabilities": "tong_no_phai_tra",
        "current_liabilities": ("coalesce", ["du_phong_nghiep_vu", "tong_no_phai_tra"]),
        "non_current_liabilities": None,
        "long_term_liabilities": None,
        "short_term_debt": None,
        "long_term_debt": None,
        "total_equity": "tong_von_chu_so_huu",
        "shareholders_equity": "tong_von_chu_so_huu",
        "charter_capital": "von_dieu_le",
        "retained_earnings": "loi_nhuan_chua_phan_phoi",
    },
    "securities": {
        "total_assets": "tong_tai_san",
        "current_assets": "tong_tai_san_ngan_han",
        "non_current_assets": "tong_tai_san_dai_han",
        "cash": "tien_va_tuong_duong_tien",
        "short_term_investments": ("sum", ["fvtpl", "afs", "htm"]),
        "accounts_receivable": ("sum", ["phai_thu_khach_hang", "cho_vay_margin"]),
        "inventories": 0,
        "total_liabilities": "tong_no_phai_tra",
        "current_liabilities": "tong_no_ngan_han",
        "non_current_liabilities": "tong_no_dai_han",
        "long_term_liabilities": "tong_no_dai_han",
        "short_term_debt": "vay_ngan_han",
        "long_term_debt": "vay_dai_han",
        "total_equity": "tong_von_chu_so_huu",
        "shareholders_equity": "tong_von_chu_so_huu",
        "charter_capital": "von_dieu_le",
        "retained_earnings": "loi_nhuan_chua_phan_phoi",
    },
}

_INCOME_FIELD_MAP = {
    "corporate": {
        "revenue": ("coalesce", ["doanh_thu_thuan", "doanh_thu_ban_hang_va_ccdv"]),
        "net_revenue": ("coalesce", ["doanh_thu_thuan", "doanh_thu_ban_hang_va_ccdv"]),
        "cost_of_revenue": "gia_von_hang_ban",
        "cost_of_goods_sold": "gia_von_hang_ban",
        "gross_profit": "loi_nhuan_gop",
        "selling_expenses": "chi_phi_ban_hang",
        "admin_expenses": "chi_phi_quan_ly_dn",
        "operating_income": "loi_nhuan_thuan_hdkd",
        "financial_income": "doanh_thu_hoat_dong_tai_chinh",
        "financial_expenses": "chi_phi_tai_chinh",
        "profit_before_tax": "loi_nhuan_truoc_thue",
        "income_tax": "chi_phi_thue_tndn",
        "net_income": "loi_nhuan_sau_thue",
        "profit": "loi_nhuan_sau_thue",
        "net_profit_to_shareholders": ("coalesce", ["loi_nhuan_cua_co_dong_ct_me", "loi_nhuan_sau_thue"]),
    },
    "bank": {
        "revenue": "tong_thu_nhap_hoat_dong",
        "net_revenue": "tong_thu_nhap_hoat_dong",
        "cost_of_revenue": "chi_phi_lai_va_tuong_tu",
        "cost_of_goods_sold": "chi_phi_lai_va_tuong_tu",
        "gross_profit": "thu_nhap_lai_thuan",
        "selling_expenses": None,
        "admin_expenses": "chi_phi_hoat_dong",
        "operating_income": "loi_nhuan_thuan_truoc_du_phong",
        "financial_income": (
            "sum",
            [
                "thu_nhap_lai_va_tuong_tu",
                "thu_nhap_tu_dich_vu",
                "lai_thuan_ngoai_hoi",
                "lai_thuan_chung_khoan",
                "lai_thuan_mua_ban_chung_khoan_dau_tu",
                "thu_nhap_khac",
            ],
        ),
        "financial_expenses": ("sum", ["chi_phi_lai_va_tuong_tu", "chi_phi_du_phong_rui_ro"]),
        "profit_before_tax": "loi_nhuan_truoc_thue",
        "income_tax": "chi_phi_thue_tndn",
        "net_income": "loi_nhuan_sau_thue",
        "profit": "loi_nhuan_sau_thue",
        "net_profit_to_shareholders": ("coalesce", ["loi_nhuan_cua_co_dong_ct_me", "loi_nhuan_sau_thue"]),
    },
    "insurance": {
        "revenue": "doanh_thu_phi_bao_hiem_thuan",
        "net_revenue": "doanh_thu_phi_bao_hiem_thuan",
        "cost_of_revenue": "chi_boi_thuong",
        "cost_of_goods_sold": "chi_boi_thuong",
        "gross_profit": "loi_nhuan_hoat_dong_bao_hiem",
        "selling_expenses": "chi_phi_khai_thac",
        "admin_expenses": "chi_phi_quan_ly",
        "operating_income": "loi_nhuan_hoat_dong_bao_hiem",
        "financial_income": "doanh_thu_hoat_dong_tai_chinh",
        "financial_expenses": None,
        "profit_before_tax": "loi_nhuan_truoc_thue",
        "income_tax": "chi_phi_thue_tndn",
        "net_income": "loi_nhuan_sau_thue",
        "profit": "loi_nhuan_sau_thue",
        "net_profit_to_shareholders": "loi_nhuan_sau_thue",
    },
    "securities": {
        "revenue": "tong_doanh_thu_hoat_dong",
        "net_revenue": "tong_doanh_thu_hoat_dong",
        "cost_of_revenue": None,
        "cost_of_goods_sold": None,
        "gross_profit": "tong_doanh_thu_hoat_dong",
        "selling_expenses": None,
        "admin_expenses": "chi_phi_hoat_dong",
        "operating_income": "loi_nhuan_truoc_thue",
        "financial_income": (
            "sum",
            [
                "doanh_thu_moi_gioi",
                "doanh_thu_tu_van",
                "doanh_thu_ngan_hang_dau_tu",
                "lai_kinh_doanh_chung_khoan",
                "lai_cho_vay_margin",
                "doanh_thu_quan_ly_quy",
            ],
        ),
        "financial_expenses": "chi_phi_hoat_dong",
        "profit_before_tax": "loi_nhuan_truoc_thue",
        "income_tax": "chi_phi_thue_tndn",
        "net_income": "loi_nhuan_sau_thue",
        "profit": "loi_nhuan_sau_thue",
        "net_profit_to_shareholders": "loi_nhuan_sau_thue",
    },
}

_CASH_FLOW_FIELD_MAP = {
    "corporate": {
        "operating_cash_flow": "lctt_thuan_hdkd",
        "investing_cash_flow": "lctt_thuan_hddt",
        "financing_cash_flow": "lctt_thuan_hdtc",
        "capex": "tien_mua_tai_san_co_dinh",
        "dividends_paid": "co_tuc_da_tra",
        "ending_cash": "tien_cuoi_ky",
        "net_change_in_cash": ("diff", ["tien_cuoi_ky", "tien_dau_ky"]),
    },
    "bank": {
        "operating_cash_flow": "lctt_thuan_hdkd",
        "investing_cash_flow": "lctt_thuan_hddt",
        "financing_cash_flow": "lctt_thuan_hdtc",
        "capex": None,
        "dividends_paid": None,
        "ending_cash": "tien_cuoi_ky",
        "net_change_in_cash": ("diff", ["tien_cuoi_ky", "tien_dau_ky"]),
    },
    "insurance": {
        "operating_cash_flow": "lctt_thuan_hdkd",
        "investing_cash_flow": "lctt_thuan_hddt",
        "financing_cash_flow": "lctt_thuan_hdtc",
        "capex": None,
        "dividends_paid": None,
        "ending_cash": "tien_cuoi_ky",
        "net_change_in_cash": ("diff", ["tien_cuoi_ky", "tien_dau_ky"]),
    },
    "securities": {
        "operating_cash_flow": "lctt_thuan_hdkd",
        "investing_cash_flow": "lctt_thuan_hddt",
        "financing_cash_flow": "lctt_thuan_hdtc",
        "capex": None,
        "dividends_paid": None,
        "ending_cash": "tien_cuoi_ky",
        "net_change_in_cash": ("diff", ["tien_cuoi_ky", "tien_dau_ky"]),
    },
}


class DatabaseManager:
    """Quản lý kết nối và truy vấn Database"""
    
    def __init__(self, database_url: str = DATABASE_URL):
        self.engine = create_engine(database_url, echo=False)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self._ensure_legacy_compatibility()

    def _object_exists(self, conn, object_name: str) -> bool:
        """Kiểm tra table/view có tồn tại trong SQLite hay không."""
        row = conn.execute(
            text(
                """
                SELECT 1
                FROM sqlite_master
                WHERE type IN ('table', 'view')
                  AND name = :name
                LIMIT 1
                """
            ),
            {"name": object_name},
        ).first()
        return row is not None

    def _create_balance_sheet_view(self, conn):
        conn.exec_driver_sql(
            """
            CREATE VIEW balance_sheets AS
            SELECT
                fc.id * 10 + 1 AS id,
                c.id AS company_id,
                'quarterly' AS period_type,
                fc.year AS period_year,
                fc.quarter AS period_quarter,
                fc.tong_tai_san AS total_assets,
                fc.tong_tai_san_ngan_han AS current_assets,
                fc.tong_tai_san_dai_han AS non_current_assets,
                fc.tien_va_tuong_duong_tien AS cash_and_equivalents,
                fc.dau_tu_tai_chinh_ngan_han AS short_term_investments,
                (COALESCE(fc.phai_thu_ngan_han_khach_hang, 0) + COALESCE(fc.phai_thu_ngan_han_khac, 0)) AS accounts_receivable,
                fc.hang_ton_kho AS inventories,
                fc.tai_san_ngan_han_khac AS other_current_assets,
                (COALESCE(fc.tai_san_co_dinh_huu_hinh, 0) + COALESCE(fc.tai_san_co_dinh_vo_hinh, 0)) AS fixed_assets,
                fc.dau_tu_tai_chinh_dai_han AS long_term_investments,
                fc.tong_no_phai_tra AS total_liabilities,
                fc.tong_no_ngan_han AS current_liabilities,
                fc.tong_no_dai_han AS non_current_liabilities,
                fc.vay_ngan_han AS short_term_debt,
                fc.vay_dai_han AS long_term_debt,
                fc.phai_tra_nguoi_ban_ngan_han AS accounts_payable,
                fc.tong_von_chu_so_huu AS total_equity,
                fc.von_gop_cua_chu_so_huu AS share_capital,
                fc.loi_nhuan_sau_thue_chua_phan_phoi AS retained_earnings
            FROM financials_corporate fc
            JOIN companies c ON c.ticker = fc.ticker AND c.company_type = 'corporate'

            UNION ALL

            SELECT
                fb.id * 10 + 2 AS id,
                c.id AS company_id,
                'quarterly' AS period_type,
                fb.year AS period_year,
                fb.quarter AS period_quarter,
                fb.tong_tai_san AS total_assets,
                fb.tong_tai_san AS current_assets,
                0 AS non_current_assets,
                (COALESCE(fb.tien_mat_vang_bac_da_quy, 0) + COALESCE(fb.tien_gui_tai_nhnn, 0)) AS cash_and_equivalents,
                fb.chung_khoan_kinh_doanh AS short_term_investments,
                fb.cho_vay_khach_hang AS accounts_receivable,
                0 AS inventories,
                0 AS other_current_assets,
                fb.tai_san_co_dinh AS fixed_assets,
                (COALESCE(fb.chung_khoan_dau_tu, 0) + COALESCE(fb.gop_von_dau_tu_dai_han, 0)) AS long_term_investments,
                fb.tong_no_phai_tra AS total_liabilities,
                fb.tong_no_phai_tra AS current_liabilities,
                0 AS non_current_liabilities,
                fb.tien_gui_vay_cac_tctd AS short_term_debt,
                fb.cac_khoan_no_chinh_phu_nhnn AS long_term_debt,
                0 AS accounts_payable,
                fb.tong_von_chu_so_huu AS total_equity,
                fb.von_dieu_le AS share_capital,
                fb.loi_nhuan_chua_phan_phoi AS retained_earnings
            FROM financials_bank fb
            JOIN companies c ON c.ticker = fb.ticker AND c.company_type = 'bank'

            UNION ALL

            SELECT
                fi.id * 10 + 3 AS id,
                c.id AS company_id,
                'quarterly' AS period_type,
                fi.year AS period_year,
                fi.quarter AS period_quarter,
                fi.tong_tai_san AS total_assets,
                fi.tong_tai_san_ngan_han AS current_assets,
                fi.tong_tai_san_dai_han AS non_current_assets,
                fi.tien_va_tuong_duong_tien AS cash_and_equivalents,
                fi.dau_tu_tai_chinh AS short_term_investments,
                fi.phai_thu_phi_bao_hiem AS accounts_receivable,
                0 AS inventories,
                fi.tai_san_ngan_han_khac AS other_current_assets,
                fi.tai_san_co_dinh AS fixed_assets,
                0 AS long_term_investments,
                fi.tong_no_phai_tra AS total_liabilities,
                fi.tong_no_phai_tra AS current_liabilities,
                0 AS non_current_liabilities,
                0 AS short_term_debt,
                0 AS long_term_debt,
                fi.phai_tra_nguoi_ban AS accounts_payable,
                fi.tong_von_chu_so_huu AS total_equity,
                fi.von_dieu_le AS share_capital,
                fi.loi_nhuan_chua_phan_phoi AS retained_earnings
            FROM financials_insurance fi
            JOIN companies c ON c.ticker = fi.ticker AND c.company_type = 'insurance'

            UNION ALL

            SELECT
                fs.id * 10 + 4 AS id,
                c.id AS company_id,
                'quarterly' AS period_type,
                fs.year AS period_year,
                fs.quarter AS period_quarter,
                fs.tong_tai_san AS total_assets,
                fs.tong_tai_san_ngan_han AS current_assets,
                fs.tong_tai_san_dai_han AS non_current_assets,
                fs.tien_va_tuong_duong_tien AS cash_and_equivalents,
                (COALESCE(fs.fvtpl, 0) + COALESCE(fs.afs, 0) + COALESCE(fs.htm, 0)) AS short_term_investments,
                (COALESCE(fs.phai_thu_khach_hang, 0) + COALESCE(fs.cho_vay_margin, 0)) AS accounts_receivable,
                0 AS inventories,
                fs.tai_san_ngan_han_khac AS other_current_assets,
                fs.tai_san_co_dinh AS fixed_assets,
                fs.dau_tu_tai_chinh_dai_han AS long_term_investments,
                fs.tong_no_phai_tra AS total_liabilities,
                fs.tong_no_ngan_han AS current_liabilities,
                fs.tong_no_dai_han AS non_current_liabilities,
                fs.vay_ngan_han AS short_term_debt,
                fs.vay_dai_han AS long_term_debt,
                fs.phai_tra_khach_hang AS accounts_payable,
                fs.tong_von_chu_so_huu AS total_equity,
                fs.von_dieu_le AS share_capital,
                fs.loi_nhuan_chua_phan_phoi AS retained_earnings
            FROM financials_securities fs
            JOIN companies c ON c.ticker = fs.ticker AND c.company_type = 'securities'
            """
        )

    def _create_income_statement_view(self, conn):
        conn.exec_driver_sql(
            """
            CREATE VIEW income_statements AS
            SELECT
                fc.id * 10 + 1 AS id,
                c.id AS company_id,
                'quarterly' AS period_type,
                fc.year AS period_year,
                fc.quarter AS period_quarter,
                COALESCE(fc.doanh_thu_thuan, fc.doanh_thu_ban_hang_va_ccdv) AS revenue,
                fc.gia_von_hang_ban AS cost_of_goods_sold,
                fc.loi_nhuan_gop AS gross_profit,
                fc.chi_phi_ban_hang AS selling_expenses,
                fc.chi_phi_quan_ly_dn AS admin_expenses,
                fc.loi_nhuan_thuan_hdkd AS operating_income,
                fc.chi_phi_tai_chinh AS financial_expenses,
                NULL AS interest_expenses,
                fc.loi_nhuan_truoc_thue AS profit_before_tax,
                fc.loi_nhuan_sau_thue AS net_profit,
                COALESCE(fc.loi_nhuan_cua_co_dong_ct_me, fc.loi_nhuan_sau_thue) AS net_profit_to_shareholders
            FROM financials_corporate fc
            JOIN companies c ON c.ticker = fc.ticker AND c.company_type = 'corporate'

            UNION ALL

            SELECT
                fb.id * 10 + 2 AS id,
                c.id AS company_id,
                'quarterly' AS period_type,
                fb.year AS period_year,
                fb.quarter AS period_quarter,
                fb.tong_thu_nhap_hoat_dong AS revenue,
                NULL AS cost_of_goods_sold,
                fb.thu_nhap_lai_thuan AS gross_profit,
                NULL AS selling_expenses,
                fb.chi_phi_hoat_dong AS admin_expenses,
                fb.loi_nhuan_thuan_truoc_du_phong AS operating_income,
                fb.chi_phi_lai_va_tuong_tu AS financial_expenses,
                fb.chi_phi_lai_va_tuong_tu AS interest_expenses,
                fb.loi_nhuan_truoc_thue AS profit_before_tax,
                fb.loi_nhuan_sau_thue AS net_profit,
                COALESCE(fb.loi_nhuan_cua_co_dong_ct_me, fb.loi_nhuan_sau_thue) AS net_profit_to_shareholders
            FROM financials_bank fb
            JOIN companies c ON c.ticker = fb.ticker AND c.company_type = 'bank'

            UNION ALL

            SELECT
                fi.id * 10 + 3 AS id,
                c.id AS company_id,
                'quarterly' AS period_type,
                fi.year AS period_year,
                fi.quarter AS period_quarter,
                fi.doanh_thu_phi_bao_hiem_thuan AS revenue,
                fi.chi_boi_thuong AS cost_of_goods_sold,
                fi.loi_nhuan_hoat_dong_bao_hiem AS gross_profit,
                fi.chi_phi_khai_thac AS selling_expenses,
                fi.chi_phi_quan_ly AS admin_expenses,
                fi.loi_nhuan_hoat_dong_bao_hiem AS operating_income,
                NULL AS financial_expenses,
                NULL AS interest_expenses,
                fi.loi_nhuan_truoc_thue AS profit_before_tax,
                fi.loi_nhuan_sau_thue AS net_profit,
                fi.loi_nhuan_sau_thue AS net_profit_to_shareholders
            FROM financials_insurance fi
            JOIN companies c ON c.ticker = fi.ticker AND c.company_type = 'insurance'

            UNION ALL

            SELECT
                fs.id * 10 + 4 AS id,
                c.id AS company_id,
                'quarterly' AS period_type,
                fs.year AS period_year,
                fs.quarter AS period_quarter,
                fs.tong_doanh_thu_hoat_dong AS revenue,
                NULL AS cost_of_goods_sold,
                fs.tong_doanh_thu_hoat_dong AS gross_profit,
                NULL AS selling_expenses,
                fs.chi_phi_hoat_dong AS admin_expenses,
                fs.loi_nhuan_truoc_thue AS operating_income,
                NULL AS financial_expenses,
                NULL AS interest_expenses,
                fs.loi_nhuan_truoc_thue AS profit_before_tax,
                fs.loi_nhuan_sau_thue AS net_profit,
                fs.loi_nhuan_sau_thue AS net_profit_to_shareholders
            FROM financials_securities fs
            JOIN companies c ON c.ticker = fs.ticker AND c.company_type = 'securities'
            """
        )

    def _create_cash_flow_view(self, conn):
        conn.exec_driver_sql(
            """
            CREATE VIEW cash_flows AS
            SELECT
                fc.id * 10 + 1 AS id,
                c.id AS company_id,
                'quarterly' AS period_type,
                fc.year AS period_year,
                fc.quarter AS period_quarter,
                fc.lctt_thuan_hdkd AS operating_cash_flow,
                fc.lctt_thuan_hddt AS investing_cash_flow,
                fc.lctt_thuan_hdtc AS financing_cash_flow,
                fc.tien_mua_tai_san_co_dinh AS capex,
                fc.co_tuc_da_tra AS dividends_paid,
                fc.tien_cuoi_ky AS ending_cash,
                (COALESCE(fc.tien_cuoi_ky, 0) - COALESCE(fc.tien_dau_ky, 0)) AS net_change_in_cash
            FROM financials_corporate fc
            JOIN companies c ON c.ticker = fc.ticker AND c.company_type = 'corporate'

            UNION ALL

            SELECT
                fb.id * 10 + 2 AS id,
                c.id AS company_id,
                'quarterly' AS period_type,
                fb.year AS period_year,
                fb.quarter AS period_quarter,
                fb.lctt_thuan_hdkd AS operating_cash_flow,
                fb.lctt_thuan_hddt AS investing_cash_flow,
                fb.lctt_thuan_hdtc AS financing_cash_flow,
                NULL AS capex,
                NULL AS dividends_paid,
                fb.tien_cuoi_ky AS ending_cash,
                (COALESCE(fb.tien_cuoi_ky, 0) - COALESCE(fb.tien_dau_ky, 0)) AS net_change_in_cash
            FROM financials_bank fb
            JOIN companies c ON c.ticker = fb.ticker AND c.company_type = 'bank'

            UNION ALL

            SELECT
                fi.id * 10 + 3 AS id,
                c.id AS company_id,
                'quarterly' AS period_type,
                fi.year AS period_year,
                fi.quarter AS period_quarter,
                fi.lctt_thuan_hdkd AS operating_cash_flow,
                fi.lctt_thuan_hddt AS investing_cash_flow,
                fi.lctt_thuan_hdtc AS financing_cash_flow,
                NULL AS capex,
                NULL AS dividends_paid,
                fi.tien_cuoi_ky AS ending_cash,
                (COALESCE(fi.tien_cuoi_ky, 0) - COALESCE(fi.tien_dau_ky, 0)) AS net_change_in_cash
            FROM financials_insurance fi
            JOIN companies c ON c.ticker = fi.ticker AND c.company_type = 'insurance'

            UNION ALL

            SELECT
                fs.id * 10 + 4 AS id,
                c.id AS company_id,
                'quarterly' AS period_type,
                fs.year AS period_year,
                fs.quarter AS period_quarter,
                fs.lctt_thuan_hdkd AS operating_cash_flow,
                fs.lctt_thuan_hddt AS investing_cash_flow,
                fs.lctt_thuan_hdtc AS financing_cash_flow,
                NULL AS capex,
                NULL AS dividends_paid,
                fs.tien_cuoi_ky AS ending_cash,
                (COALESCE(fs.tien_cuoi_ky, 0) - COALESCE(fs.tien_dau_ky, 0)) AS net_change_in_cash
            FROM financials_securities fs
            JOIN companies c ON c.ticker = fs.ticker AND c.company_type = 'securities'
            """
        )

    def _ensure_legacy_compatibility(self):
        """Tự động tạo lớp tương thích giữa schema mới và backend legacy."""
        with self.engine.begin() as conn:
            objects = {
                row[0]
                for row in conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')")
                ).fetchall()
            }

            if "companies" in objects:
                company_columns = {
                    row[1] for row in conn.exec_driver_sql("PRAGMA table_info(companies)").fetchall()
                }

                if "shares_outstanding" not in company_columns:
                    conn.exec_driver_sql("ALTER TABLE companies ADD COLUMN shares_outstanding BIGINT")

                conn.exec_driver_sql(
                    """
                    UPDATE companies
                    SET shares_outstanding = CAST(
                        CASE
                            WHEN current_price IS NOT NULL
                                 AND current_price > 0
                                 AND market_cap IS NOT NULL
                                 AND market_cap > 0
                            THEN ROUND(market_cap * 1.0 / current_price)
                            ELSE NULL
                        END AS INTEGER
                    )
                    WHERE shares_outstanding IS NULL OR shares_outstanding <= 0
                    """
                )

            source_tables = {
                "financials_corporate",
                "financials_bank",
                "financials_insurance",
                "financials_securities",
            }

            if source_tables.issubset(objects):
                if "balance_sheets" not in objects:
                    self._create_balance_sheet_view(conn)
                if "income_statements" not in objects:
                    self._create_income_statement_view(conn)
                if "cash_flows" not in objects:
                    self._create_cash_flow_view(conn)
        
    @contextmanager
    def get_session(self):
        """Context manager cho database session"""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def get_all_companies(self) -> pd.DataFrame:
        """Lấy danh sách tất cả công ty"""
        query = """
        SELECT 
            c.id, c.ticker, c.name, c.industry,
            c.market_cap, c.shares_outstanding, c.current_price
        FROM companies c
        ORDER BY c.ticker
        """
        return pd.read_sql(query, self.engine)
    
    def get_company_by_ticker(self, ticker: str) -> dict:
        """Lấy thông tin công ty theo mã CK"""
        with self.get_session() as session:
            company = session.query(Company).filter(Company.ticker == ticker).first()
            if company:
                return {
                    "id": company.id,
                    "ticker": company.ticker,
                    "name": company.name,
                    "industry": company.industry,
                    "market_cap": company.market_cap,
                    "shares_outstanding": company.shares_outstanding,
                    "current_price": company.current_price
                }
            return None

    def _get_company_profile(self, ticker: str) -> dict[str, Any] | None:
        """Lấy metadata công ty từ bảng companies (bao gồm company_type)."""
        query = text(
            """
            SELECT id, ticker, name, industry, company_type
            FROM companies
            WHERE UPPER(ticker) = :ticker
            LIMIT 1
            """
        )
        with self.engine.connect() as conn:
            row = conn.execute(query, {"ticker": ticker.upper()}).mappings().first()
        return dict(row) if row else None

    def _build_mapped_expr(
        self,
        spec: Any,
        available_slugs: set[str],
        table_alias: str = "f",
    ) -> str:
        """Biên dịch field spec thành SQL expression theo danh sách slug hợp lệ."""
        if spec is None:
            return "NULL"

        if isinstance(spec, (int, float)):
            return str(spec)

        if isinstance(spec, str):
            return f"{table_alias}.{spec}" if spec in available_slugs else "NULL"

        if not isinstance(spec, tuple) or len(spec) != 2:
            return "NULL"

        op, values = spec
        valid_slugs = [slug for slug in values if slug in available_slugs]

        if op == "coalesce":
            if not valid_slugs:
                return "NULL"
            if len(valid_slugs) == 1:
                return f"{table_alias}.{valid_slugs[0]}"
            joined = ", ".join(f"{table_alias}.{slug}" for slug in valid_slugs)
            return f"COALESCE({joined})"

        if op == "sum":
            if not valid_slugs:
                return "NULL"
            return " + ".join(f"COALESCE({table_alias}.{slug}, 0)" for slug in valid_slugs)

        if op == "diff":
            if not valid_slugs:
                return "NULL"
            if len(valid_slugs) == 1:
                return f"{table_alias}.{valid_slugs[0]}"
            sub_expr = " + ".join(
                f"COALESCE({table_alias}.{slug}, 0)" for slug in valid_slugs[1:]
            )
            return f"(COALESCE({table_alias}.{valid_slugs[0]}, 0) - ({sub_expr}))"

        return "NULL"

    def _get_company_statement_data(self, ticker: str, statement_key: str) -> list[dict[str, Any]]:
        """Lấy dữ liệu báo cáo đã map theo company_type cho UI xem CDKT/KQKD/LCTT."""
        company = self._get_company_profile(ticker)
        if not company:
            return []

        company_type = (company.get("company_type") or "corporate").lower()
        table_name = _COMPANY_TYPE_TABLE_MAP.get(company_type)
        slug_sets = _STATEMENT_SLUGS_BY_COMPANY_TYPE.get(company_type, {})
        available_slugs = slug_sets.get(statement_key, set())

        if not table_name or not available_slugs:
            return []

        if statement_key == "balance_sheets":
            field_map = _BALANCE_FIELD_MAP.get(company_type, {})
        elif statement_key == "income_statements":
            field_map = _INCOME_FIELD_MAP.get(company_type, {})
        elif statement_key == "cash_flows":
            field_map = _CASH_FLOW_FIELD_MAP.get(company_type, {})
        else:
            return []

        mapped_fields = []
        if field_map:
            mapped_fields = [
                f"{self._build_mapped_expr(spec, available_slugs)} AS {field_name}"
                for field_name, spec in field_map.items()
            ]

        # Trả toàn bộ cột statement slug để frontend có thể hiển thị đầy đủ.
        raw_slug_fields = [
            f"f.{slug} AS {slug}"
            for slug in sorted(available_slugs)
            if slug not in field_map
        ]

        select_fields = mapped_fields + raw_slug_fields
        if not select_fields:
            return []

        query = f"""
        SELECT
            f.ticker,
            f.year AS period_year,
            f.year AS fiscal_year,
            'quarterly' AS period_type,
            f.quarter AS period_quarter,
            f.quarter AS quarter,
            CASE
                WHEN f.quarter IS NOT NULL AND f.quarter > 0
                THEN 'Q' || CAST(f.quarter AS TEXT) || '/' || CAST(f.year AS TEXT)
                ELSE CAST(f.year AS TEXT)
            END AS period_label,
            {",\n            ".join(select_fields)}
        FROM {table_name} f
        WHERE UPPER(f.ticker) = :ticker
        ORDER BY f.year DESC, COALESCE(f.quarter, 0) DESC
        """

        df = pd.read_sql(text(query), self.engine, params={"ticker": ticker.upper()})
        if df.empty:
            return []

        df["company_type"] = company_type
        return df.where(pd.notnull(df), None).to_dict("records")

    def get_company_balance_sheets_mapped(self, ticker: str) -> list[dict[str, Any]]:
        """CDKT đã map theo loại công ty cho frontend."""
        return self._get_company_statement_data(ticker, "balance_sheets")

    def get_company_income_statements_mapped(self, ticker: str) -> list[dict[str, Any]]:
        """KQKD đã map theo loại công ty cho frontend."""
        return self._get_company_statement_data(ticker, "income_statements")

    def get_company_cash_flows_mapped(self, ticker: str) -> list[dict[str, Any]]:
        """LCTT đã map theo loại công ty cho frontend."""
        return self._get_company_statement_data(ticker, "cash_flows")
    
    def get_financial_summary(self, ticker: str) -> pd.DataFrame:
        """
        Lấy tổng hợp dữ liệu tài chính theo năm
        Bao gồm: Doanh thu, Lợi nhuận, EPS, BVPS, các chỉ số tài chính
        """
        query = """
        SELECT 
            i.period_year as year,
            i.revenue,
            i.gross_profit,
            i.operating_income,
            i.net_profit,
            i.net_profit_to_shareholders,
            b.total_assets,
            b.total_liabilities,
            b.total_equity,
            b.current_assets,
            b.current_liabilities,
            b.cash_and_equivalents,
            b.inventories,
            b.short_term_debt,
            b.long_term_debt,
            c.shares_outstanding,
            c.current_price,
            cf.operating_cash_flow,
            cf.capex,
            cf.investing_cash_flow,
            cf.financing_cash_flow
        FROM companies c
        JOIN income_statements i ON c.id = i.company_id
        JOIN balance_sheets b ON c.id = b.company_id 
            AND i.period_year = b.period_year 
            AND i.period_type = b.period_type
            AND COALESCE(i.period_quarter, 0) = COALESCE(b.period_quarter, 0)
        JOIN cash_flows cf ON c.id = cf.company_id 
            AND i.period_year = cf.period_year 
            AND i.period_type = cf.period_type
            AND COALESCE(i.period_quarter, 0) = COALESCE(cf.period_quarter, 0)
        WHERE c.ticker = :ticker
            AND i.period_type IN ('annual', 'quarterly')
        ORDER BY i.period_year, COALESCE(i.period_quarter, 0)
        """
        df = pd.read_sql(text(query), self.engine, params={"ticker": ticker})
        
        if df.empty:
            return df
            
        # Tính toán các chỉ số tài chính
        df['eps'] = df['net_profit_to_shareholders'] / df['shares_outstanding']
        df['bvps'] = df['total_equity'] / df['shares_outstanding']
        
        # Chi so thi truong (dung gia hien tai)
        current_price = df['current_price'].iloc[-1] if not df.empty else 0
        df['pe_ratio'] = current_price / df['eps'].replace(0, float('nan'))
        df['pb_ratio'] = current_price / df['bvps'].replace(0, float('nan'))
        # Note: dividend_per_share chưa có trong database, set default = 0
        df['dividend_yield'] = 0
        
        # Chỉ số sức khỏe tài chính
        df['de_ratio'] = df['total_liabilities'] / df['total_equity'].replace(0, float('nan'))
        df['quick_ratio'] = (df['current_assets'] - df['inventories']) / df['current_liabilities'].replace(0, float('nan'))
        df['current_ratio'] = df['current_assets'] / df['current_liabilities'].replace(0, float('nan'))
        
        # Chỉ số hiệu quả hoạt động
        df['roe'] = (df['net_profit'] / df['total_equity'].replace(0, float('nan')) * 100).round(2)
        df['roa'] = (df['net_profit'] / df['total_assets'].replace(0, float('nan')) * 100).round(2)
        df['gross_margin'] = (df['gross_profit'] / df['revenue'].replace(0, float('nan')) * 100).round(2)
        df['net_margin'] = (df['net_profit'] / df['revenue'].replace(0, float('nan')) * 100).round(2)
        df['operating_margin'] = (df['operating_income'] / df['revenue'].replace(0, float('nan')) * 100).round(2)
        
        # ROIC = NOPAT / Invested Capital
        # NOPAT ≈ Operating Income * (1 - Tax Rate), Tax Rate ≈ 20%
        df['nopat'] = df['operating_income'] * 0.8
        df['invested_capital'] = df['total_equity'] + df['short_term_debt'] + df['long_term_debt'] - df['cash_and_equivalents']
        df['roic'] = (df['nopat'] / df['invested_capital'].replace(0, float('nan')) * 100).round(2)
        
        # Tăng trưởng YoY
        df['revenue_growth'] = df['revenue'].pct_change() * 100
        df['profit_growth'] = df['net_profit'].pct_change() * 100
        
        return df
    
    def get_company_financials_detailed(self, ticker: str) -> dict:
        """Lấy dữ liệu tài chính chi tiết theo format frontend cần"""
        company = self._get_company_profile(ticker)
        if not company:
            return None

        income_df = pd.DataFrame(self.get_company_income_statements_mapped(ticker))
        balance_df = pd.DataFrame(self.get_company_balance_sheets_mapped(ticker))
        cashflow_df = pd.DataFrame(self.get_company_cash_flows_mapped(ticker))

        # Calculate ratio columns used by analysis screens.
        if not balance_df.empty and not income_df.empty:
            merge_keys = ["fiscal_year"]
            if "quarter" in income_df.columns and "quarter" in balance_df.columns:
                merge_keys.append("quarter")

            merged = income_df.merge(
                balance_df[merge_keys + ["total_equity", "total_assets"]],
                on=merge_keys,
                how="left",
            )

            for col in ["revenue", "net_income", "gross_profit", "total_equity", "total_assets"]:
                merged[col] = pd.to_numeric(merged[col], errors="coerce")

            merged["roe"] = (
                merged["net_income"] / merged["total_equity"].replace(0, float("nan")) * 100
            ).fillna(0).round(2)
            merged["roa"] = (
                merged["net_income"] / merged["total_assets"].replace(0, float("nan")) * 100
            ).fillna(0).round(2)
            merged["gross_margin"] = (
                merged["gross_profit"] / merged["revenue"].replace(0, float("nan")) * 100
            ).fillna(0).round(2)
            merged["net_margin"] = (
                merged["net_income"] / merged["revenue"].replace(0, float("nan")) * 100
            ).fillna(0).round(2)

            income_df = income_df.merge(
                merged[merge_keys + ["roe", "roa", "gross_margin", "net_margin"]],
                on=merge_keys,
                how="left",
            )

        return {
            "income_statements": income_df.where(pd.notnull(income_df), 0).to_dict("records"),
            "balance_sheets": balance_df.where(pd.notnull(balance_df), 0).to_dict("records"),
            "cash_flows": cashflow_df.where(pd.notnull(cashflow_df), 0).to_dict("records"),
        }

    def get_balance_sheet_structure(self, ticker: str) -> pd.DataFrame:
        """Lấy cơ cấu Bảng cân đối kế toán để vẽ biểu đồ"""
        query = """
        SELECT 
            b.period_year as year,
            b.cash_and_equivalents,
            b.short_term_investments,
            b.accounts_receivable,
            b.inventories,
            b.other_current_assets,
            b.fixed_assets,
            b.long_term_investments,
            (b.non_current_assets - b.fixed_assets - b.long_term_investments) as other_non_current,
            b.short_term_debt,
            b.accounts_payable,
            (b.current_liabilities - b.short_term_debt - b.accounts_payable) as other_current_liab,
            b.long_term_debt,
            (b.non_current_liabilities - b.long_term_debt) as other_non_current_liab,
            b.share_capital,
            b.retained_earnings,
            (b.total_equity - b.share_capital - b.retained_earnings) as other_equity
        FROM companies c
        JOIN balance_sheets b ON c.id = b.company_id
        WHERE c.ticker = :ticker
            AND b.period_type IN ('annual', 'quarterly')
        ORDER BY b.period_year, COALESCE(b.period_quarter, 0)
        """
        return pd.read_sql(text(query), self.engine, params={"ticker": ticker})
    
    def get_cash_flow_data(self, ticker: str) -> pd.DataFrame:
        """Lấy dữ liệu dòng tiền"""
        query = """
        SELECT 
            cf.period_year as year,
            cf.operating_cash_flow,
            cf.investing_cash_flow,
            cf.financing_cash_flow,
            cf.capex,
            cf.dividends_paid,
            cf.net_change_in_cash,
            i.net_profit
        FROM companies c
        JOIN cash_flows cf ON c.id = cf.company_id
        JOIN income_statements i ON c.id = i.company_id 
            AND cf.period_year = i.period_year
            AND cf.period_type = i.period_type
            AND COALESCE(cf.period_quarter, 0) = COALESCE(i.period_quarter, 0)
        WHERE c.ticker = :ticker
            AND cf.period_type IN ('annual', 'quarterly')
        ORDER BY cf.period_year, COALESCE(cf.period_quarter, 0)
        """
        return pd.read_sql(text(query), self.engine, params={"ticker": ticker})
    
    def screen_stocks(self, filters: dict) -> pd.DataFrame:
        """
        Bộ lọc cổ phiếu thông minh
        
        filters có thể bao gồm:
        - min_roe: ROE tối thiểu (%)
        - max_de: D/E tối đa
        - min_profit_growth: Tăng trưởng LN tối thiểu (%)
        - max_pe: P/E tối đa
        - min_pe: P/E tối thiểu
        - max_pb: P/B tối đa
        - min_dividend_yield: Dividend Yield tối thiểu (%)
        - consecutive_roe_years: Số năm liên tiếp ROE đạt min_roe
        - industry: Lọc theo ngành
        """
        # Query cơ bản với các chỉ số tài chính
        query = """
        WITH yearly_metrics AS (
            SELECT 
                c.id,
                c.ticker,
                c.name,
                c.industry,
                c.current_price,
                c.shares_outstanding,
                c.market_cap,
                i.period_year,
                i.revenue,
                i.net_profit,
                i.net_profit_to_shareholders,
                0 as dividend_per_share,  -- Not available in current schema
                b.total_assets,
                b.total_liabilities,
                b.total_equity,
                b.current_assets,
                b.current_liabilities,
                b.inventories,
                -- Calculated metrics
                CASE WHEN b.total_equity > 0 THEN 
                    ROUND(i.net_profit * 100.0 / b.total_equity, 2) 
                ELSE 0 END as roe,
                CASE WHEN b.total_equity > 0 THEN 
                    ROUND(b.total_liabilities * 1.0 / b.total_equity, 2) 
                ELSE 0 END as de_ratio,
                CASE WHEN b.total_assets > 0 THEN 
                    ROUND(i.net_profit * 100.0 / b.total_assets, 2) 
                ELSE 0 END as roa
            FROM companies c
            JOIN income_statements i ON c.id = i.company_id
            JOIN balance_sheets b ON c.id = b.company_id 
                AND i.period_year = b.period_year 
                AND i.period_type = b.period_type
                AND COALESCE(i.period_quarter, 0) = COALESCE(b.period_quarter, 0)
            WHERE i.period_type = 'annual'
               OR (i.period_type = 'quarterly' AND i.period_quarter = 4)
        ),
        latest_year AS (
            SELECT MAX(period_year) as max_year FROM yearly_metrics
        ),
        latest_metrics AS (
            SELECT 
                ym.*,
                CASE WHEN ym.shares_outstanding > 0 THEN 
                    ROUND(ym.net_profit_to_shareholders * 1.0 / ym.shares_outstanding, 2) 
                ELSE 0 END as eps,
                CASE WHEN ym.shares_outstanding > 0 THEN 
                    ROUND(ym.total_equity * 1.0 / ym.shares_outstanding, 2) 
                ELSE 0 END as bvps
            FROM yearly_metrics ym, latest_year ly
            WHERE ym.period_year = ly.max_year
        ),
        growth_calc AS (
            SELECT 
                ym1.id,
                CASE WHEN ym0.net_profit > 0 THEN 
                    ROUND((ym1.net_profit - ym0.net_profit) * 100.0 / ym0.net_profit, 2)
                ELSE 0 END as profit_growth,
                CASE WHEN ym0.revenue > 0 THEN 
                    ROUND((ym1.revenue - ym0.revenue) * 100.0 / ym0.revenue, 2)
                ELSE 0 END as revenue_growth
            FROM yearly_metrics ym1
            JOIN yearly_metrics ym0 ON ym1.id = ym0.id AND ym1.period_year = ym0.period_year + 1
            JOIN latest_year ly ON ym1.period_year = ly.max_year
        )
        SELECT 
            lm.ticker,
            lm.name,
            lm.industry,
            lm.current_price,
            lm.market_cap,
            lm.revenue,
            lm.net_profit,
            lm.eps,
            lm.bvps,
            lm.roe,
            lm.roa,
            lm.de_ratio,
            CASE WHEN lm.eps > 0 THEN ROUND(lm.current_price / lm.eps, 2) ELSE 0 END as pe_ratio,
            CASE WHEN lm.bvps > 0 THEN ROUND(lm.current_price / lm.bvps, 2) ELSE 0 END as pb_ratio,
            0 as dividend_yield,  -- dividend_per_share not available in current schema
            COALESCE(gc.profit_growth, 0) as profit_growth,
            COALESCE(gc.revenue_growth, 0) as revenue_growth,
            ROUND((lm.current_assets - lm.inventories) * 1.0 / NULLIF(lm.current_liabilities, 0), 2) as quick_ratio
        FROM latest_metrics lm
        LEFT JOIN growth_calc gc ON lm.id = gc.id
        WHERE 1=1
        """
        
        params = {}
        
        # Apply filters
        if filters.get('min_roe'):
            query += " AND lm.roe >= :min_roe"
            params['min_roe'] = filters['min_roe']
            
        if filters.get('max_de'):
            query += " AND lm.de_ratio <= :max_de"
            params['max_de'] = filters['max_de']
            
        if filters.get('max_pe'):
            query += " AND (lm.eps <= 0 OR lm.current_price / lm.eps <= :max_pe)"
            params['max_pe'] = filters['max_pe']
            
        if filters.get('min_pe'):
            query += " AND lm.eps > 0 AND lm.current_price / lm.eps >= :min_pe"
            params['min_pe'] = filters['min_pe']
            
        if filters.get('max_pb'):
            query += " AND (lm.bvps <= 0 OR lm.current_price / lm.bvps <= :max_pb)"
            params['max_pb'] = filters['max_pb']
            
        if filters.get('min_dividend_yield'):
            # Note: dividend_per_share not available in current schema
            # query += " AND lm.current_price > 0 AND (lm.dividend_per_share * 100.0 / lm.current_price) >= :min_div"
            # params['min_div'] = filters['min_dividend_yield']
            pass
            
        if filters.get('industry'):
            query += " AND lm.industry = :industry"
            params['industry'] = filters['industry']
        
        query += " ORDER BY lm.roe DESC"
        
        df = pd.read_sql(text(query), self.engine, params=params)
        
        # Filter for consecutive ROE years if specified
        if filters.get('consecutive_roe_years') and filters.get('min_roe'):
            valid_tickers = self._check_consecutive_roe(
                filters['min_roe'], 
                filters['consecutive_roe_years']
            )
            df = df[df['ticker'].isin(valid_tickers)]
        
        # Filter for minimum profit growth if specified
        if filters.get('min_profit_growth'):
            df = df[df['profit_growth'] >= filters['min_profit_growth']]
        
        return df
    
    def _check_consecutive_roe(self, min_roe: float, years: int) -> list:
        """Kiểm tra ROE đạt ngưỡng trong n năm liên tiếp"""
        query = """
        WITH roe_data AS (
            SELECT 
                c.ticker,
                i.period_year,
                CASE WHEN b.total_equity > 0 THEN 
                    i.net_profit * 100.0 / b.total_equity 
                ELSE 0 END as roe
            FROM companies c
            JOIN income_statements i ON c.id = i.company_id
            JOIN balance_sheets b ON c.id = b.company_id 
                AND i.period_year = b.period_year
                AND COALESCE(i.period_quarter, 0) = COALESCE(b.period_quarter, 0)
            WHERE i.period_type = 'annual'
               OR (i.period_type = 'quarterly' AND i.period_quarter = 4)
            ORDER BY c.ticker, i.period_year DESC
        )
        SELECT ticker, COUNT(*) as consecutive_years
        FROM (
            SELECT ticker, period_year, roe,
                   ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY period_year DESC) as rn
            FROM roe_data
            WHERE roe >= :min_roe
        ) sub
        WHERE rn <= :years
        GROUP BY ticker
        HAVING COUNT(*) >= :years
        """
        result = pd.read_sql(text(query), self.engine, params={
            "min_roe": min_roe, 
            "years": years
        })
        return result['ticker'].tolist()
    
# Singleton instance
db_manager = DatabaseManager()


def get_db():
    """Get database manager instance"""
    return db_manager
