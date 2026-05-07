from fastapi import APIRouter, Query
from backend.database import get_db
import pandas as pd
import numpy as np

router = APIRouter(prefix="/api/screener", tags=["screener"])

@router.get('/advanced')
def advanced_screener(
    sort_by: str = Query('market_cap'),
    sort_order: str = Query('desc'),
    limit: int = Query(100),
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
    
    query = """
    WITH yearly_metrics AS (
        SELECT 
            c.id, c.ticker, c.name, c.industry, c.current_price, c.market_cap,
            i.period_year, i.revenue, i.net_profit, i.gross_profit, i.net_profit_to_shareholders,
            b.total_assets, b.total_liabilities, b.total_equity, b.current_assets, b.current_liabilities, b.inventories,
            cf.operating_cash_flow, b.long_term_debt, c.shares_outstanding as shares
        FROM companies c
        JOIN income_statements i ON c.id = i.company_id
        JOIN balance_sheets b ON c.id = b.company_id 
            AND i.period_year = b.period_year 
            AND i.period_type = b.period_type
            AND COALESCE(i.period_quarter, 0) = COALESCE(b.period_quarter, 0)
        LEFT JOIN cash_flows cf ON c.id = cf.company_id
            AND i.period_year = cf.period_year 
            AND i.period_type = cf.period_type
            AND COALESCE(i.period_quarter, 0) = COALESCE(cf.period_quarter, 0)
        WHERE i.period_type = 'annual'
           OR (i.period_type = 'quarterly' AND i.period_quarter = 4)
    ),
    latest_year AS (
        SELECT MAX(period_year) as max_year FROM yearly_metrics
    ),
    latest_metrics AS (
        SELECT ym.* FROM yearly_metrics ym, latest_year ly WHERE ym.period_year = ly.max_year
    ),
    prev_metrics AS (
        SELECT ym.* FROM yearly_metrics ym, latest_year ly WHERE ym.period_year = ly.max_year - 1
    )
    SELECT 
        lm.ticker, lm.name, lm.industry, lm.current_price as price, lm.market_cap, lm.shares,
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
        
        -- Piotroski F-Score components
        CASE WHEN lm.net_profit > 0 THEN 1 ELSE 0 END +
        CASE WHEN lm.operating_cash_flow > 0 THEN 1 ELSE 0 END +
        CASE WHEN (CASE WHEN lm.total_assets > 0 THEN lm.net_profit * 1.0 / lm.total_assets ELSE 0 END) > 
                  (CASE WHEN pm.total_assets > 0 THEN pm.net_profit * 1.0 / pm.total_assets ELSE 0 END) THEN 1 ELSE 0 END +
        CASE WHEN COALESCE(lm.operating_cash_flow, 0) > lm.net_profit THEN 1 ELSE 0 END +
        CASE WHEN (CASE WHEN lm.total_assets > 0 THEN COALESCE(lm.long_term_debt, 0) * 1.0 / lm.total_assets ELSE 0 END) < 
                  (CASE WHEN pm.total_assets > 0 THEN COALESCE(pm.long_term_debt, 0) * 1.0 / pm.total_assets ELSE 0 END) THEN 1 ELSE 0 END +
        CASE WHEN (CASE WHEN lm.current_liabilities > 0 THEN lm.current_assets * 1.0 / lm.current_liabilities ELSE 0 END) > 
                  (CASE WHEN pm.current_liabilities > 0 THEN pm.current_assets * 1.0 / pm.current_liabilities ELSE 0 END) THEN 1 ELSE 0 END +
        CASE WHEN lm.shares <= pm.shares THEN 1 ELSE 0 END +
        CASE WHEN (CASE WHEN lm.revenue > 0 THEN lm.gross_profit * 1.0 / lm.revenue ELSE 0 END) > 
                  (CASE WHEN pm.revenue > 0 THEN pm.gross_profit * 1.0 / pm.revenue ELSE 0 END) THEN 1 ELSE 0 END +
        CASE WHEN (CASE WHEN lm.total_assets > 0 THEN lm.revenue * 1.0 / lm.total_assets ELSE 0 END) > 
                  (CASE WHEN pm.total_assets > 0 THEN pm.revenue * 1.0 / pm.total_assets ELSE 0 END) THEN 1 ELSE 0 END as f_score
    FROM latest_metrics lm
    LEFT JOIN prev_metrics pm ON lm.ticker = pm.ticker
    """
    
    try:
        df = pd.read_sql(query, db.engine)
        
        # Calculate PE and PB
        df['pe_ratio'] = np.where((df['eps'] > 0) & (df['price'].notna()), df['price'] / df['eps'], np.nan)
        df['pb_ratio'] = np.where((df['bvps'] > 0) & (df['price'].notna()), df['price'] / df['bvps'], np.nan)
        
        # Fill NaN values for safe filtering
        df = df.fillna({
            'pe_ratio': -9999,
            'pb_ratio': -9999,
            'roe': -9999,
            'roa': -9999,
            'gross_margin': -9999,
            'net_margin': -9999,
            'de_ratio': 9999,
            'current_ratio': -9999,
            'f_score': 0,
            'revenue_growth': -9999,
            'profit_growth': -9999,
        })
        
        # Apply filters
        if min_pe is not None: df = df[df['pe_ratio'] >= min_pe]
        if max_pe is not None: df = df[(df['pe_ratio'] <= max_pe) & (df['pe_ratio'] != -9999)]
        if min_pb is not None: df = df[df['pb_ratio'] >= min_pb]
        if max_pb is not None: df = df[(df['pb_ratio'] <= max_pb) & (df['pb_ratio'] != -9999)]
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
        
        # Convert -9999 / 9999 back to None for output
        df = df.replace([-9999, 9999], [None, None])
        
        # Ensure all NaNs and Infinities are converted to None for JSON serialization
        df = df.replace([np.inf, -np.inf], [np.nan, np.nan])
        df = df.astype(object).where(pd.notnull(df), None)
        
        # Sort
        if sort_by in df.columns:
            df = df.sort_values(by=sort_by, ascending=(sort_order == 'asc'), na_position='last')
        else:
            df = df.sort_values(by='market_cap', ascending=False, na_position='last')
            
        # Return results
        results = df.head(limit).to_dict(orient='records')
        return {
            "total": len(df),
            "limit": limit,
            "results": results
        }
        
    except Exception as e:
        print(f"Error filtering companies: {e}")
        return []
