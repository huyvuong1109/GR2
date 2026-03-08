"""
Sample SQL Queries for Stock Screening
Các câu truy vấn SQL mẫu để lọc cổ phiếu theo tiêu chí cơ bản
"""

# ============================================================
# 1. LỌC CỔ PHIẾU CÓ ROE > 15% VÀ P/E < 10
# ============================================================

QUERY_ROE_PE = """
WITH latest_data AS (
    SELECT 
        c.ticker,
        c.name,
        c.industry,
        c.current_price,
        c.shares_outstanding,
        i.net_profit,
        i.net_profit_to_shareholders,
        b.total_equity,
        -- ROE = Lợi nhuận ròng / Vốn chủ sở hữu
        CASE WHEN b.total_equity > 0 THEN 
            ROUND(i.net_profit * 100.0 / b.total_equity, 2) 
        END as roe,
        -- EPS = Lợi nhuận / Số CP lưu hành
        CASE WHEN c.shares_outstanding > 0 THEN 
            i.net_profit_to_shareholders * 1.0 / c.shares_outstanding 
        END as eps
    FROM companies c
    JOIN income_statements i ON c.id = i.company_id
    JOIN balance_sheets b ON c.id = b.company_id 
        AND i.period_year = b.period_year
    WHERE i.period_type = 'annual'
        AND i.period_year = (SELECT MAX(period_year) FROM income_statements)
)
SELECT 
    ticker,
    name,
    industry,
    current_price,
    ROUND(roe, 2) as roe_percent,
    ROUND(eps, 2) as eps,
    ROUND(current_price / NULLIF(eps, 0), 2) as pe_ratio
FROM latest_data
WHERE roe > 15  -- ROE > 15%
    AND eps > 0  -- Có lãi
    AND (current_price / eps) < 10  -- P/E < 10
ORDER BY roe DESC;
"""


# ============================================================
# 2. LỌC CỔ PHIẾU GIÁ TRỊ: ROE > 15%, P/B < 1.5, D/E < 0.5
# ============================================================

QUERY_VALUE_STOCKS = """
WITH financial_metrics AS (
    SELECT 
        c.ticker,
        c.name,
        c.industry,
        c.current_price,
        c.shares_outstanding,
        i.net_profit,
        i.net_profit_to_shareholders,
        b.total_equity,
        b.total_liabilities,
        -- Calculated metrics
        CASE WHEN b.total_equity > 0 THEN 
            ROUND(i.net_profit * 100.0 / b.total_equity, 2) 
        END as roe,
        CASE WHEN b.total_equity > 0 THEN 
            ROUND(b.total_liabilities * 1.0 / b.total_equity, 2) 
        END as de_ratio,
        CASE WHEN c.shares_outstanding > 0 THEN 
            b.total_equity * 1.0 / c.shares_outstanding 
        END as bvps
    FROM companies c
    JOIN income_statements i ON c.id = i.company_id
    JOIN balance_sheets b ON c.id = b.company_id 
        AND i.period_year = b.period_year
    WHERE i.period_type = 'annual'
        AND i.period_year = (SELECT MAX(period_year) FROM income_statements)
)
SELECT 
    ticker,
    name,
    industry,
    current_price,
    roe as roe_percent,
    de_ratio,
    ROUND(bvps, 2) as bvps,
    ROUND(current_price / NULLIF(bvps, 0), 2) as pb_ratio
FROM financial_metrics
WHERE roe > 15          -- ROE > 15%
    AND de_ratio < 0.5  -- Nợ/Vốn < 0.5
    AND bvps > 0
    AND (current_price / bvps) < 1.5  -- P/B < 1.5
ORDER BY roe DESC;
"""


# ============================================================
# 3. LỌC CỔ PHIẾU TĂNG TRƯỞNG: Tăng trưởng doanh thu & LN > 10% 
#    trong 3 năm liên tiếp
# ============================================================

QUERY_GROWTH_STOCKS = """
WITH yearly_growth AS (
    SELECT 
        c.ticker,
        c.name,
        i.period_year,
        i.revenue,
        i.net_profit,
        -- Tăng trưởng so với năm trước
        LAG(i.revenue) OVER (PARTITION BY c.id ORDER BY i.period_year) as prev_revenue,
        LAG(i.net_profit) OVER (PARTITION BY c.id ORDER BY i.period_year) as prev_profit
    FROM companies c
    JOIN income_statements i ON c.id = i.company_id
    WHERE i.period_type = 'annual'
),
growth_calc AS (
    SELECT 
        ticker,
        name,
        period_year,
        CASE WHEN prev_revenue > 0 THEN 
            ROUND((revenue - prev_revenue) * 100.0 / prev_revenue, 2)
        END as revenue_growth,
        CASE WHEN prev_profit > 0 THEN 
            ROUND((net_profit - prev_profit) * 100.0 / prev_profit, 2)
        END as profit_growth
    FROM yearly_growth
    WHERE prev_revenue IS NOT NULL
),
consecutive_growth AS (
    SELECT 
        ticker,
        name,
        COUNT(*) as years_of_growth
    FROM growth_calc
    WHERE revenue_growth > 10  -- Tăng trưởng DT > 10%
        AND profit_growth > 10  -- Tăng trưởng LN > 10%
        AND period_year >= (SELECT MAX(period_year) - 2 FROM growth_calc)  -- 3 năm gần nhất
    GROUP BY ticker, name
    HAVING COUNT(*) >= 3  -- Ít nhất 3 năm liên tiếp
)
SELECT 
    cg.ticker,
    cg.name,
    c.industry,
    c.current_price,
    cg.years_of_growth
FROM consecutive_growth cg
JOIN companies c ON c.ticker = cg.ticker
ORDER BY cg.years_of_growth DESC;
"""


# ============================================================
# 4. LỌC CỔ PHIẾU CỔ TỨC CAO: Dividend Yield > 5%, Payout < 70%
# ============================================================

QUERY_DIVIDEND_STOCKS = """
WITH dividend_data AS (
    SELECT 
        c.ticker,
        c.name,
        c.industry,
        c.current_price,
        c.shares_outstanding,
        i.net_profit_to_shareholders,
        i.dividend_per_share,
        -- Dividend Yield = Cổ tức / Giá
        CASE WHEN c.current_price > 0 THEN 
            ROUND(i.dividend_per_share * 100.0 / c.current_price, 2) 
        END as dividend_yield,
        -- Payout Ratio = Tổng cổ tức / Lợi nhuận
        CASE WHEN i.net_profit_to_shareholders > 0 THEN 
            ROUND(i.dividend_per_share * c.shares_outstanding * 100.0 / i.net_profit_to_shareholders, 2)
        END as payout_ratio
    FROM companies c
    JOIN income_statements i ON c.id = i.company_id
    WHERE i.period_type = 'annual'
        AND i.period_year = (SELECT MAX(period_year) FROM income_statements)
        AND i.dividend_per_share > 0
)
SELECT 
    ticker,
    name,
    industry,
    current_price,
    dividend_per_share,
    dividend_yield,
    payout_ratio
FROM dividend_data
WHERE dividend_yield > 5    -- Tỷ suất cổ tức > 5%
    AND payout_ratio < 70   -- Tỷ lệ chi trả < 70% (bền vững)
ORDER BY dividend_yield DESC;
"""


# ============================================================
# 5. LỌC CỔ PHIẾU CHẤT LƯỢNG: ROE cao + Dòng tiền tốt
# ============================================================

QUERY_QUALITY_STOCKS = """
WITH quality_metrics AS (
    SELECT 
        c.ticker,
        c.name,
        c.industry,
        c.current_price,
        i.net_profit,
        b.total_equity,
        cf.operating_cash_flow,
        -- ROE
        CASE WHEN b.total_equity > 0 THEN 
            ROUND(i.net_profit * 100.0 / b.total_equity, 2) 
        END as roe,
        -- Cash Flow / Net Profit ratio (chất lượng lợi nhuận)
        CASE WHEN i.net_profit > 0 THEN 
            ROUND(cf.operating_cash_flow * 100.0 / i.net_profit, 2) 
        END as cf_to_profit_ratio
    FROM companies c
    JOIN income_statements i ON c.id = i.company_id
    JOIN balance_sheets b ON c.id = b.company_id 
        AND i.period_year = b.period_year
    JOIN cash_flows cf ON c.id = cf.company_id 
        AND i.period_year = cf.period_year
    WHERE i.period_type = 'annual'
        AND i.period_year = (SELECT MAX(period_year) FROM income_statements)
)
SELECT 
    ticker,
    name,
    industry,
    current_price,
    roe as roe_percent,
    cf_to_profit_ratio
FROM quality_metrics
WHERE roe > 15                    -- ROE > 15%
    AND cf_to_profit_ratio > 80   -- Dòng tiền >= 80% lợi nhuận (chất lượng tốt)
ORDER BY roe DESC, cf_to_profit_ratio DESC;
"""


# ============================================================
# 6. LỌC CỔ PHIẾU THEO NHIỀU TIÊU CHÍ KẾT HỢP
#    (Dành cho Value Investor nghiêm túc)
# ============================================================

QUERY_COMPREHENSIVE_SCREENER = """
WITH 
-- Dữ liệu năm gần nhất
latest_year AS (
    SELECT MAX(period_year) as max_year FROM income_statements WHERE period_type = 'annual'
),
-- Chỉ số tài chính cơ bản
financial_metrics AS (
    SELECT 
        c.id,
        c.ticker,
        c.name,
        c.industry,
        c.current_price,
        c.shares_outstanding,
        c.market_cap,
        i.revenue,
        i.net_profit,
        i.net_profit_to_shareholders,
        i.gross_profit,
        i.dividend_per_share,
        b.total_assets,
        b.total_liabilities,
        b.total_equity,
        b.current_assets,
        b.current_liabilities,
        b.inventories,
        cf.operating_cash_flow,
        cf.capex
    FROM companies c
    JOIN income_statements i ON c.id = i.company_id
    JOIN balance_sheets b ON c.id = b.company_id 
        AND i.period_year = b.period_year
    JOIN cash_flows cf ON c.id = cf.company_id 
        AND i.period_year = cf.period_year
    JOIN latest_year ly ON i.period_year = ly.max_year
    WHERE i.period_type = 'annual'
),
-- Tính tăng trưởng
growth_data AS (
    SELECT 
        c.id,
        ROUND(AVG(
            CASE WHEN i2.net_profit > 0 THEN 
                (i1.net_profit - i2.net_profit) * 100.0 / i2.net_profit 
            END
        ), 2) as avg_profit_growth_3y
    FROM companies c
    JOIN income_statements i1 ON c.id = i1.company_id
    JOIN income_statements i2 ON c.id = i2.company_id 
        AND i1.period_year = i2.period_year + 1
    WHERE i1.period_type = 'annual'
        AND i1.period_year >= (SELECT max_year - 2 FROM latest_year)
    GROUP BY c.id
),
-- Tính các chỉ số
calculated_metrics AS (
    SELECT 
        fm.*,
        -- Profitability
        ROUND(fm.net_profit * 100.0 / NULLIF(fm.total_equity, 0), 2) as roe,
        ROUND(fm.net_profit * 100.0 / NULLIF(fm.total_assets, 0), 2) as roa,
        ROUND(fm.gross_profit * 100.0 / NULLIF(fm.revenue, 0), 2) as gross_margin,
        ROUND(fm.net_profit * 100.0 / NULLIF(fm.revenue, 0), 2) as net_margin,
        -- Valuation
        fm.net_profit_to_shareholders / NULLIF(fm.shares_outstanding, 0) as eps,
        fm.total_equity / NULLIF(fm.shares_outstanding, 0) as bvps,
        -- Safety
        ROUND(fm.total_liabilities * 1.0 / NULLIF(fm.total_equity, 0), 2) as de_ratio,
        ROUND((fm.current_assets - fm.inventories) * 1.0 / NULLIF(fm.current_liabilities, 0), 2) as quick_ratio,
        -- Cash Quality
        ROUND(fm.operating_cash_flow * 100.0 / NULLIF(fm.net_profit, 0), 2) as cf_quality,
        -- Free Cash Flow
        fm.operating_cash_flow + fm.capex as fcf,
        -- Growth
        gd.avg_profit_growth_3y
    FROM financial_metrics fm
    LEFT JOIN growth_data gd ON fm.id = gd.id
)
SELECT 
    ticker,
    name,
    industry,
    current_price,
    market_cap,
    -- Valuation ratios
    ROUND(current_price / NULLIF(eps, 0), 2) as pe_ratio,
    ROUND(current_price / NULLIF(bvps, 0), 2) as pb_ratio,
    ROUND(dividend_per_share * 100.0 / NULLIF(current_price, 0), 2) as dividend_yield,
    -- Profitability
    roe,
    roa,
    gross_margin,
    net_margin,
    -- Safety
    de_ratio,
    quick_ratio,
    -- Quality
    cf_quality,
    -- Growth
    avg_profit_growth_3y
FROM calculated_metrics
WHERE 
    -- Điều kiện lọc (có thể tùy chỉnh)
    roe > 15                          -- ROE > 15%
    AND de_ratio < 1.0                -- Nợ/Vốn < 1
    AND quick_ratio > 1.0             -- Khả năng thanh toán nhanh > 1
    AND cf_quality > 70               -- Chất lượng dòng tiền > 70%
    AND eps > 0                       -- Có lãi
    AND (current_price / eps) < 15    -- P/E < 15
ORDER BY 
    roe DESC,
    avg_profit_growth_3y DESC;
"""


# ============================================================
# 7. QUERY LẤY DỮ LIỆU CHO BIỂU ĐỒ TĂNG TRƯỞNG
# ============================================================

QUERY_GROWTH_CHART_DATA = """
SELECT 
    i.period_year as year,
    i.revenue / 1000000000 as revenue_billion,  -- Đơn vị: tỷ đồng
    i.net_profit / 1000000000 as profit_billion,
    i.gross_profit / 1000000000 as gross_profit_billion,
    -- YoY Growth
    ROUND((i.revenue - LAG(i.revenue) OVER (ORDER BY i.period_year)) * 100.0 
        / NULLIF(LAG(i.revenue) OVER (ORDER BY i.period_year), 0), 2) as revenue_growth,
    ROUND((i.net_profit - LAG(i.net_profit) OVER (ORDER BY i.period_year)) * 100.0 
        / NULLIF(LAG(i.net_profit) OVER (ORDER BY i.period_year), 0), 2) as profit_growth
FROM companies c
JOIN income_statements i ON c.id = i.company_id
WHERE c.ticker = :ticker  -- Thay bằng mã CK cần xem
    AND i.period_type = 'annual'
ORDER BY i.period_year;
"""


# ============================================================
# 8. QUERY LẤY CƠ CẤU TÀI SẢN VÀ NGUỒN VỐN
# ============================================================

QUERY_BALANCE_SHEET_STRUCTURE = """
SELECT 
    b.period_year as year,
    -- Cơ cấu tài sản (Assets)
    ROUND(b.cash_and_equivalents * 100.0 / b.total_assets, 2) as cash_pct,
    ROUND(b.accounts_receivable * 100.0 / b.total_assets, 2) as receivables_pct,
    ROUND(b.inventories * 100.0 / b.total_assets, 2) as inventory_pct,
    ROUND(b.fixed_assets * 100.0 / b.total_assets, 2) as fixed_assets_pct,
    ROUND((b.total_assets - b.cash_and_equivalents - b.accounts_receivable 
           - b.inventories - b.fixed_assets) * 100.0 / b.total_assets, 2) as other_assets_pct,
    -- Cơ cấu nguồn vốn (Liabilities & Equity)
    ROUND(b.current_liabilities * 100.0 / b.total_assets, 2) as current_liab_pct,
    ROUND(b.non_current_liabilities * 100.0 / b.total_assets, 2) as non_current_liab_pct,
    ROUND(b.total_equity * 100.0 / b.total_assets, 2) as equity_pct
FROM companies c
JOIN balance_sheets b ON c.id = b.company_id
WHERE c.ticker = :ticker
    AND b.period_type = 'annual'
ORDER BY b.period_year;
"""


if __name__ == "__main__":
    # Print sample queries
    print("=" * 60)
    print("SAMPLE SQL QUERIES FOR STOCK SCREENING")
    print("=" * 60)
    
    queries = [
        ("1. ROE > 15% và P/E < 10", QUERY_ROE_PE),
        ("2. Value Stocks: ROE > 15%, P/B < 1.5, D/E < 0.5", QUERY_VALUE_STOCKS),
        ("3. Growth Stocks: Tăng trưởng > 10% trong 3 năm", QUERY_GROWTH_STOCKS),
        ("4. Dividend Stocks: Yield > 5%, Payout < 70%", QUERY_DIVIDEND_STOCKS),
        ("5. Quality Stocks: ROE cao + Dòng tiền tốt", QUERY_QUALITY_STOCKS),
    ]
    
    for title, query in queries:
        print(f"\n{title}")
        print("-" * 50)
        print(query[:500] + "..." if len(query) > 500 else query)
