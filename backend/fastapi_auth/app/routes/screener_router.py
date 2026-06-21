from fastapi import APIRouter, Query
from backend.database import get_db
import pandas as pd
import numpy as np

router = APIRouter(prefix="/api/screener", tags=["screener"])


def _is_past_period(period_year) -> bool:
    return bool(period_year)


@router.get('/advanced')
def advanced_screener(
    sort_by: str = Query('market_cap'),
    sort_order: str = Query('desc'),
    limit: int = Query(100),
    period_year: int = Query(None),
    period_quarter: int = Query(None),
    min_pe: float = Query(None),
    max_pe: float = Query(None),
    min_pb: float = Query(None),
    max_pb: float = Query(None),
    min_roe: float = Query(None),
    max_roe: float = Query(None),
    min_roa: float = Query(None),
    min_gross_margin: float = Query(None),
    min_net_margin: float = Query(None),
    max_de: float = Query(None),
    min_current_ratio: float = Query(None),
    min_f_score: float = Query(None),
    min_revenue_growth: float = Query(None),
    min_profit_growth: float = Query(None),
):
    """Screener nâng cao - dữ liệu thực từ database analytics(final).db"""
    db = get_db()

    is_past = _is_past_period(period_year)
    price_filters_used = any([
        min_pe is not None, max_pe is not None,
        min_pb is not None, max_pb is not None,
    ])

    price_warning = None
    if is_past and price_filters_used:
        if period_quarter:
            period_label = f"Quý {period_quarter}/{period_year}"
        else:
            period_label = f"Năm {period_year}"
        price_warning = (
            f"Dữ liệu giá cổ phiếu tại {period_label} không có trong hệ thống. "
            "Bộ lọc P/E và P/B sẽ được bỏ qua — chỉ các tiêu chí không liên quan đến giá (ROE, ROA, F-Score...) được áp dụng."
        )

    # ---- Xây dựng điều kiện WHERE cho kỳ được chọn ----
    if period_year and period_quarter:
        period_where_lm = f"i.period_year = {period_year} AND i.period_type = 'quarterly' AND i.period_quarter = {period_quarter}"
        period_where_lm_b = f"b.period_year = {period_year} AND b.period_type = 'quarterly' AND b.period_quarter = {period_quarter}"
        period_where_lm_cf = f"cf.period_year = {period_year} AND cf.period_type = 'quarterly' AND cf.period_quarter = {period_quarter}"
        # Kỳ trước: quý liền trước (trong cùng năm hoặc sang năm trước)
        prev_year = period_year if period_quarter > 1 else period_year - 1
        prev_quarter = period_quarter - 1 if period_quarter > 1 else 4
        period_where_pm = f"i.period_year = {prev_year} AND i.period_type = 'quarterly' AND i.period_quarter = {prev_quarter}"
        period_where_pm_b = f"b.period_year = {prev_year} AND b.period_type = 'quarterly' AND b.period_quarter = {prev_quarter}"
        period_where_pm_cf = f"cf.period_year = {prev_year} AND cf.period_type = 'quarterly' AND cf.period_quarter = {prev_quarter}"
    elif period_year:
        period_where_lm = f"i.period_year = {period_year} AND (i.period_type = 'annual' OR (i.period_type = 'quarterly' AND i.period_quarter = 4))"
        period_where_lm_b = f"b.period_year = {period_year} AND (b.period_type = 'annual' OR (b.period_type = 'quarterly' AND b.period_quarter = 4))"
        period_where_lm_cf = f"cf.period_year = {period_year} AND (cf.period_type = 'annual' OR (cf.period_type = 'quarterly' AND cf.period_quarter = 4))"
        prev_year = period_year - 1
        period_where_pm = f"i.period_year = {prev_year} AND (i.period_type = 'annual' OR (i.period_type = 'quarterly' AND i.period_quarter = 4))"
        period_where_pm_b = f"b.period_year = {prev_year} AND (b.period_type = 'annual' OR (b.period_type = 'quarterly' AND b.period_quarter = 4))"
        period_where_pm_cf = f"cf.period_year = {prev_year} AND (cf.period_type = 'annual' OR (cf.period_type = 'quarterly' AND cf.period_quarter = 4))"
    else:
        # Kỳ mới nhất: dùng MAX year/quarter
        period_where_lm = "(i.period_type = 'annual' OR (i.period_type = 'quarterly' AND i.period_quarter = 4))"
        period_where_lm_b = "(b.period_type = 'annual' OR (b.period_type = 'quarterly' AND b.period_quarter = 4))"
        period_where_lm_cf = "(cf.period_type = 'annual' OR (cf.period_type = 'quarterly' AND cf.period_quarter = 4))"
        period_where_pm = None
        period_where_pm_b = None
        period_where_pm_cf = None

    # ---- Nguồn giá ----
    if is_past:
        # Chỉ lấy từ price_history — nếu không có → NULL (không tính P/E, P/B)
        if period_quarter:
            quarter_end_month = {1: '03', 2: '06', 3: '09', 4: '12'}.get(period_quarter, '12')
            hist_prefix = f"{period_year}-{quarter_end_month}"
        else:
            hist_prefix = f"{period_year}-12"
        price_expr = f"""(
            SELECT ph.close_price FROM price_history ph
            WHERE ph.ticker = c.ticker AND ph.trade_date LIKE '{hist_prefix}%'
            ORDER BY ph.trade_date DESC LIMIT 1
        )"""
    else:
        price_expr = "c.current_price"

    # ---- Query cho kỳ mới nhất (dùng MAX) ----
    if not period_year:
        query = f"""
        WITH all_annual AS (
            SELECT
                c.id, c.ticker, c.name, c.industry, {price_expr} as price,
                c.market_cap, c.shares_outstanding as shares,
                i.period_year, i.period_quarter,
                i.revenue, i.net_profit, i.gross_profit, i.net_profit_to_shareholders,
                b.total_assets, b.total_liabilities, b.total_equity,
                b.current_assets, b.current_liabilities, b.inventories,
                cf.operating_cash_flow, b.long_term_debt
            FROM companies c
            JOIN income_statements i ON c.id = i.company_id
                AND ({period_where_lm})
            JOIN balance_sheets b ON c.id = b.company_id
                AND i.period_year = b.period_year AND i.period_type = b.period_type
                AND COALESCE(i.period_quarter,0) = COALESCE(b.period_quarter,0)
            LEFT JOIN cash_flows cf ON c.id = cf.company_id
                AND i.period_year = cf.period_year AND i.period_type = cf.period_type
                AND COALESCE(i.period_quarter,0) = COALESCE(cf.period_quarter,0)
        ),
        max_year AS (
            SELECT ticker, MAX(period_year) as max_year FROM all_annual GROUP BY ticker
        ),
        lm AS (
            SELECT a.* FROM all_annual a JOIN max_year m ON a.ticker = m.ticker AND a.period_year = m.max_year
        ),
        prev_annual AS (
            SELECT
                c.id, c.ticker,
                i.period_year,
                i.revenue, i.net_profit, i.gross_profit,
                b.total_assets, b.total_liabilities, b.total_equity,
                b.current_assets, b.current_liabilities, b.long_term_debt,
                c.shares_outstanding as shares
            FROM companies c
            JOIN income_statements i ON c.id = i.company_id
                AND ({period_where_lm})
            JOIN balance_sheets b ON c.id = b.company_id
                AND i.period_year = b.period_year AND i.period_type = b.period_type
                AND COALESCE(i.period_quarter,0) = COALESCE(b.period_quarter,0)
        ),
        prev_max AS (
            SELECT ticker, MAX(period_year) as max_year FROM prev_annual GROUP BY ticker
        ),
        pm AS (
            SELECT a.* FROM prev_annual a
            JOIN prev_max m ON a.ticker = m.ticker AND a.period_year = m.max_year
            JOIN max_year lmax ON a.ticker = lmax.ticker AND a.period_year < lmax.max_year
        )
        SELECT
            lm.ticker, lm.name, lm.industry, lm.price,
            lm.market_cap, lm.shares,
            CASE WHEN lm.shares > 0 THEN lm.net_profit_to_shareholders * 1.0 / lm.shares ELSE 0 END as eps,
            CASE WHEN lm.shares > 0 THEN lm.total_equity * 1.0 / lm.shares ELSE 0 END as bvps,
            CASE WHEN lm.total_equity > 0 THEN lm.net_profit * 100.0 / lm.total_equity ELSE 0 END as roe,
            CASE WHEN lm.total_assets > 0 THEN lm.net_profit * 100.0 / lm.total_assets ELSE 0 END as roa,
            CASE WHEN lm.total_equity > 0 THEN lm.total_liabilities * 1.0 / lm.total_equity ELSE 0 END as de_ratio,
            CASE WHEN lm.revenue > 0 THEN lm.gross_profit * 100.0 / lm.revenue ELSE 0 END as gross_margin,
            CASE WHEN lm.revenue > 0 THEN lm.net_profit * 100.0 / lm.revenue ELSE 0 END as net_margin,
            CASE WHEN lm.current_liabilities > 0 THEN lm.current_assets * 1.0 / lm.current_liabilities ELSE 0 END as current_ratio,
            CASE WHEN pm.revenue > 0 THEN (lm.revenue - pm.revenue) * 100.0 / pm.revenue ELSE 0 END as revenue_growth,
            CASE WHEN pm.net_profit > 0 THEN (lm.net_profit - pm.net_profit) * 100.0 / pm.net_profit ELSE 0 END as profit_growth,
            CASE WHEN lm.net_profit > 0 THEN 1 ELSE 0 END +
            CASE WHEN lm.operating_cash_flow > 0 THEN 1 ELSE 0 END +
            CASE WHEN (CASE WHEN lm.total_assets>0 THEN lm.net_profit*1.0/lm.total_assets ELSE 0 END) >
                      (CASE WHEN pm.total_assets>0 THEN pm.net_profit*1.0/pm.total_assets ELSE 0 END) THEN 1 ELSE 0 END +
            CASE WHEN COALESCE(lm.operating_cash_flow,0) > lm.net_profit THEN 1 ELSE 0 END +
            CASE WHEN (CASE WHEN lm.total_assets>0 THEN COALESCE(lm.long_term_debt,0)*1.0/lm.total_assets ELSE 0 END) <
                      (CASE WHEN pm.total_assets>0 THEN COALESCE(pm.long_term_debt,0)*1.0/pm.total_assets ELSE 0 END) THEN 1 ELSE 0 END +
            CASE WHEN (CASE WHEN lm.current_liabilities>0 THEN lm.current_assets*1.0/lm.current_liabilities ELSE 0 END) >
                      (CASE WHEN pm.current_liabilities>0 THEN pm.current_assets*1.0/pm.current_liabilities ELSE 0 END) THEN 1 ELSE 0 END +
            CASE WHEN lm.shares <= pm.shares THEN 1 ELSE 0 END +
            CASE WHEN (CASE WHEN lm.revenue>0 THEN lm.gross_profit*1.0/lm.revenue ELSE 0 END) >
                      (CASE WHEN pm.revenue>0 THEN pm.gross_profit*1.0/pm.revenue ELSE 0 END) THEN 1 ELSE 0 END +
            CASE WHEN (CASE WHEN lm.total_assets>0 THEN lm.revenue*1.0/lm.total_assets ELSE 0 END) >
                      (CASE WHEN pm.total_assets>0 THEN pm.revenue*1.0/pm.total_assets ELSE 0 END) THEN 1 ELSE 0 END as f_score
        FROM lm LEFT JOIN pm ON lm.ticker = pm.ticker
        """
    else:
        # ---- Query kỳ cụ thể (year hoặc year+quarter) ----
        pm_join = ""
        pm_select_growth = "0 as revenue_growth, 0 as profit_growth,"
        pm_select_fscore_prev = """
            0 as _pm_net_profit, 0 as _pm_total_assets, 0 as _pm_ocf,
            0 as _pm_long_term_debt, 0 as _pm_current_assets, 0 as _pm_current_liabilities,
            0 as _pm_shares, 0 as _pm_gross_profit, 0 as _pm_revenue,
        """

        query = f"""
        WITH lm AS (
            SELECT
                c.id, c.ticker, c.name, c.industry, {price_expr} as price,
                c.market_cap, c.shares_outstanding as shares,
                i.period_year, i.period_quarter,
                i.revenue, i.net_profit, i.gross_profit, i.net_profit_to_shareholders,
                b.total_assets, b.total_liabilities, b.total_equity,
                b.current_assets, b.current_liabilities, b.inventories,
                cf.operating_cash_flow, b.long_term_debt
            FROM companies c
            JOIN income_statements i ON c.id = i.company_id AND ({period_where_lm})
            JOIN balance_sheets b ON c.id = b.company_id
                AND ({period_where_lm_b})
                AND i.period_type = b.period_type
                AND COALESCE(i.period_quarter,0) = COALESCE(b.period_quarter,0)
            LEFT JOIN cash_flows cf ON c.id = cf.company_id
                AND ({period_where_lm_cf})
                AND i.period_type = cf.period_type
                AND COALESCE(i.period_quarter,0) = COALESCE(cf.period_quarter,0)
        ),
        pm AS (
            SELECT
                c.ticker,
                i.revenue, i.net_profit, i.gross_profit,
                b.total_assets, b.total_liabilities, b.total_equity,
                b.current_assets, b.current_liabilities, b.long_term_debt,
                c.shares_outstanding as shares
            FROM companies c
            JOIN income_statements i ON c.id = i.company_id AND ({period_where_pm})
            JOIN balance_sheets b ON c.id = b.company_id
                AND ({period_where_pm_b})
                AND i.period_type = b.period_type
                AND COALESCE(i.period_quarter,0) = COALESCE(b.period_quarter,0)
        )
        SELECT
            lm.ticker, lm.name, lm.industry, lm.price,
            lm.market_cap, lm.shares,
            CASE WHEN lm.shares > 0 THEN lm.net_profit_to_shareholders * 1.0 / lm.shares ELSE 0 END as eps,
            CASE WHEN lm.shares > 0 THEN lm.total_equity * 1.0 / lm.shares ELSE 0 END as bvps,
            CASE WHEN lm.total_equity > 0 THEN lm.net_profit * 100.0 / lm.total_equity ELSE 0 END as roe,
            CASE WHEN lm.total_assets > 0 THEN lm.net_profit * 100.0 / lm.total_assets ELSE 0 END as roa,
            CASE WHEN lm.total_equity > 0 THEN lm.total_liabilities * 1.0 / lm.total_equity ELSE 0 END as de_ratio,
            CASE WHEN lm.revenue > 0 THEN lm.gross_profit * 100.0 / lm.revenue ELSE 0 END as gross_margin,
            CASE WHEN lm.revenue > 0 THEN lm.net_profit * 100.0 / lm.revenue ELSE 0 END as net_margin,
            CASE WHEN lm.current_liabilities > 0 THEN lm.current_assets * 1.0 / lm.current_liabilities ELSE 0 END as current_ratio,
            CASE WHEN pm.revenue > 0 THEN (lm.revenue - pm.revenue) * 100.0 / pm.revenue ELSE 0 END as revenue_growth,
            CASE WHEN pm.net_profit > 0 THEN (lm.net_profit - pm.net_profit) * 100.0 / pm.net_profit ELSE 0 END as profit_growth,
            CASE WHEN lm.net_profit > 0 THEN 1 ELSE 0 END +
            CASE WHEN lm.operating_cash_flow > 0 THEN 1 ELSE 0 END +
            CASE WHEN (CASE WHEN lm.total_assets>0 THEN lm.net_profit*1.0/lm.total_assets ELSE 0 END) >
                      (CASE WHEN pm.total_assets>0 THEN pm.net_profit*1.0/pm.total_assets ELSE 0 END) THEN 1 ELSE 0 END +
            CASE WHEN COALESCE(lm.operating_cash_flow,0) > lm.net_profit THEN 1 ELSE 0 END +
            CASE WHEN (CASE WHEN lm.total_assets>0 THEN COALESCE(lm.long_term_debt,0)*1.0/lm.total_assets ELSE 0 END) <
                      (CASE WHEN pm.total_assets>0 THEN COALESCE(pm.long_term_debt,0)*1.0/pm.total_assets ELSE 0 END) THEN 1 ELSE 0 END +
            CASE WHEN (CASE WHEN lm.current_liabilities>0 THEN lm.current_assets*1.0/lm.current_liabilities ELSE 0 END) >
                      (CASE WHEN pm.current_liabilities>0 THEN pm.current_assets*1.0/pm.current_liabilities ELSE 0 END) THEN 1 ELSE 0 END +
            CASE WHEN lm.shares <= pm.shares THEN 1 ELSE 0 END +
            CASE WHEN (CASE WHEN lm.revenue>0 THEN lm.gross_profit*1.0/lm.revenue ELSE 0 END) >
                      (CASE WHEN pm.revenue>0 THEN pm.gross_profit*1.0/pm.revenue ELSE 0 END) THEN 1 ELSE 0 END +
            CASE WHEN (CASE WHEN lm.total_assets>0 THEN lm.revenue*1.0/lm.total_assets ELSE 0 END) >
                      (CASE WHEN pm.total_assets>0 THEN pm.revenue*1.0/pm.total_assets ELSE 0 END) THEN 1 ELSE 0 END as f_score
        FROM lm LEFT JOIN pm ON lm.ticker = pm.ticker
        """

    try:
        df = pd.read_sql(query, db.engine)

        # P/E và P/B — nếu price=NULL (kỳ quá khứ không có giá lịch sử) → NaN → hiển thị "-"
        df['pe_ratio'] = np.where(
            (df['eps'] > 0) & (df['price'].notna()), df['price'] / df['eps'], np.nan
        )
        df['pb_ratio'] = np.where(
            (df['bvps'] > 0) & (df['price'].notna()), df['price'] / df['bvps'], np.nan
        )

        # Fill sentinel cho các cột không liên quan giá
        df = df.fillna({
            'roe': -9999, 'roa': -9999, 'gross_margin': -9999, 'net_margin': -9999,
            'de_ratio': 9999, 'current_ratio': -9999, 'f_score': 0,
            'revenue_growth': -9999, 'profit_growth': -9999,
        })

        # Áp dụng filter — bỏ qua P/E, P/B nếu kỳ quá khứ (không có giá)
        if not is_past:
            if min_pe is not None: df = df[df['pe_ratio'].notna() & (df['pe_ratio'] >= min_pe)]
            if max_pe is not None: df = df[df['pe_ratio'].notna() & (df['pe_ratio'] <= max_pe)]
            if min_pb is not None: df = df[df['pb_ratio'].notna() & (df['pb_ratio'] >= min_pb)]
            if max_pb is not None: df = df[df['pb_ratio'].notna() & (df['pb_ratio'] <= max_pb)]

        if min_roe is not None: df = df[df['roe'] >= min_roe]
        if max_roe is not None: df = df[df['roe'] <= max_roe]
        if min_roa is not None: df = df[df['roa'] >= min_roa]
        if min_gross_margin is not None: df = df[df['gross_margin'] >= min_gross_margin]
        if min_net_margin is not None: df = df[df['net_margin'] >= min_net_margin]
        if max_de is not None: df = df[df['de_ratio'] <= max_de]
        if min_current_ratio is not None: df = df[df['current_ratio'] >= min_current_ratio]
        if min_f_score is not None: df = df[df['f_score'] >= min_f_score]
        if min_revenue_growth is not None: df = df[df['revenue_growth'] >= min_revenue_growth]
        if min_profit_growth is not None: df = df[df['profit_growth'] >= min_profit_growth]

        # Convert sentinel → None
        df = df.replace([-9999, 9999], [None, None])
        df = df.replace([np.inf, -np.inf], [np.nan, np.nan])
        df = df.astype(object).where(pd.notnull(df), None)

        # Sort
        if sort_by in df.columns:
            df = df.sort_values(by=sort_by, ascending=(sort_order == 'asc'), na_position='last')
        else:
            df = df.sort_values(by='market_cap', ascending=False, na_position='last')

        results = df.head(limit).to_dict(orient='records')
        return {
            "total": len(df),
            "limit": limit,
            "results": results,
            "is_past_period": is_past,
            "price_warning": price_warning,
            "has_historical_price": False if is_past else True,
        }

    except Exception as e:
        print(f"Error in screener: {e}")
        import traceback; traceback.print_exc()
        return {"total": 0, "limit": limit, "results": [], "is_past_period": is_past, "price_warning": None}


@router.get('/periods')
def get_periods():
    """Lấy danh sách các kỳ có sẵn trong database."""
    db = get_db()
    query = """
    SELECT DISTINCT period_year as year, period_quarter as quarter
    FROM income_statements
    WHERE period_year IS NOT NULL
    ORDER BY period_year DESC, period_quarter DESC
    """
    try:
        df = pd.read_sql(query, db.engine)
        return {"periods": df.to_dict(orient='records')}
    except Exception as e:
        print(f"Error fetching periods: {e}")
        return {"periods": []}
