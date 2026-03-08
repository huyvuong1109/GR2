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

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from Database.models import (
    Company, BalanceSheet, IncomeStatement, CashFlow,
    Base, init_db
)
from backend.config import DATABASE_URL


class DatabaseManager:
    """Quản lý kết nối và truy vấn Database"""
    
    def __init__(self, database_url: str = DATABASE_URL):
        self.engine = create_engine(database_url, echo=False)
        self.SessionLocal = sessionmaker(bind=self.engine)
        
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
        JOIN cash_flows cf ON c.id = cf.company_id 
            AND i.period_year = cf.period_year 
            AND i.period_type = cf.period_type
        WHERE c.ticker = :ticker
            AND i.period_type = 'annual'
        ORDER BY i.period_year
        """
        df = pd.read_sql(text(query), self.engine, params={"ticker": ticker})
        
        if df.empty:
            return df
            
        # Tính toán các chỉ số tài chính
        df['eps'] = df['net_profit_to_shareholders'] / df['shares_outstanding']
        df['bvps'] = df['total_equity'] / df['shares_outstanding']
        
        # Chỉ số định giá (dùng giá hiện tại)
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
        with self.get_session() as session:
            company = session.query(Company).filter(Company.ticker == ticker).first()
            if not company:
                return None
            
            # Income Statements
            income_query = """
            SELECT 
                period_year as fiscal_year,
                revenue,
                cost_of_goods_sold,
                gross_profit,
                selling_expenses,
                admin_expenses,
                operating_income,
                financial_expenses,
                interest_expenses,
                profit_before_tax,
                net_profit as net_income,
                net_profit_to_shareholders
            FROM income_statements 
            WHERE company_id = :company_id AND period_type = 'annual'
            ORDER BY period_year
            """
            
            # Balance Sheets
            balance_query = """
            SELECT 
                period_year as fiscal_year,
                total_assets,
                current_assets,
                cash_and_equivalents,
                short_term_investments,
                accounts_receivable,
                inventories,
                non_current_assets,
                fixed_assets,
                total_liabilities,
                current_liabilities,
                short_term_debt,
                non_current_liabilities,
                long_term_debt,
                total_equity,
                retained_earnings
            FROM balance_sheets 
            WHERE company_id = :company_id AND period_type = 'annual'
            ORDER BY period_year
            """
            
            # Cash Flows
            cashflow_query = """
            SELECT 
                period_year as fiscal_year,
                operating_cash_flow,
                investing_cash_flow,
                capex,
                financing_cash_flow,
                dividends_paid,
                ending_cash
            FROM cash_flows 
            WHERE company_id = :company_id AND period_type = 'annual'
            ORDER BY period_year
            """
            
            income_df = pd.read_sql(text(income_query), self.engine, params={"company_id": company.id})
            balance_df = pd.read_sql(text(balance_query), self.engine, params={"company_id": company.id})
            cashflow_df = pd.read_sql(text(cashflow_query), self.engine, params={"company_id": company.id})
            
            # Calculate financial ratios for income statements
            if not balance_df.empty and not income_df.empty:
                # Merge để tính ratios
                merged = income_df.merge(balance_df, on='fiscal_year', how='inner')
                
                # Convert to numeric first to avoid round() error
                merged['revenue'] = pd.to_numeric(merged['revenue'], errors='coerce')
                merged['net_income'] = pd.to_numeric(merged['net_income'], errors='coerce')
                merged['gross_profit'] = pd.to_numeric(merged['gross_profit'], errors='coerce')
                merged['total_equity'] = pd.to_numeric(merged['total_equity'], errors='coerce')
                merged['total_assets'] = pd.to_numeric(merged['total_assets'], errors='coerce')
                
                merged['roe'] = (merged['net_income'] / merged['total_equity'].replace(0, float('nan')) * 100).fillna(0)
                merged['roa'] = (merged['net_income'] / merged['total_assets'].replace(0, float('nan')) * 100).fillna(0)
                merged['gross_margin'] = (merged['gross_profit'] / merged['revenue'].replace(0, float('nan')) * 100).fillna(0)
                merged['net_margin'] = (merged['net_income'] / merged['revenue'].replace(0, float('nan')) * 100).fillna(0)
                
                # Round after calculation
                merged['roe'] = merged['roe'].round(2)
                merged['roa'] = merged['roa'].round(2)
                merged['gross_margin'] = merged['gross_margin'].round(2)
                merged['net_margin'] = merged['net_margin'].round(2)
                
                # Update income_df with ratios
                for col in ['roe', 'roa', 'gross_margin', 'net_margin']:
                    income_df[col] = merged[col] if col in merged.columns else 0
            
            result = {
                "income_statements": income_df.fillna(0).to_dict('records'),
                "balance_sheets": balance_df.fillna(0).to_dict('records'),
                "cash_flows": cashflow_df.fillna(0).to_dict('records')
            }
            
            return result

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
            AND b.period_type = 'annual'
        ORDER BY b.period_year
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
        WHERE c.ticker = :ticker
            AND cf.period_type = 'annual'
        ORDER BY cf.period_year
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
            WHERE i.period_type = 'annual'
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
            WHERE i.period_type = 'annual'
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
    
    def get_valuation_inputs(self, ticker: str) -> dict:
        """Lấy dữ liệu đầu vào cho định giá"""
        # Lấy dữ liệu mới nhất (annual hoặc quarterly)
        query = """
        SELECT 
            c.ticker,
            c.current_price,
            c.shares_outstanding,
            i.net_profit_to_shareholders as net_profit,
            i.revenue,
            b.total_equity,
            b.total_assets,
            cf.operating_cash_flow,
            cf.capex,
            i.period_type,
            i.period_year
        FROM companies c
        JOIN income_statements i ON c.id = i.company_id
        JOIN balance_sheets b ON c.id = b.company_id 
            AND i.period_year = b.period_year
            AND (i.period_quarter IS NULL OR i.period_quarter = b.period_quarter)
        JOIN cash_flows cf ON c.id = cf.company_id 
            AND i.period_year = cf.period_year
            AND (i.period_quarter IS NULL OR i.period_quarter = cf.period_quarter)
        WHERE c.ticker = :ticker
        ORDER BY i.period_year DESC, 
                 CASE WHEN i.period_type = 'annual' THEN 0 ELSE 1 END,
                 i.period_quarter DESC NULLS LAST
        LIMIT 1
        """
        df = pd.read_sql(text(query), self.engine, params={"ticker": ticker})
        if df.empty:
            return None
        
        row = df.iloc[0]
        shares = row['shares_outstanding'] or 1
        net_profit = row['net_profit'] or 0
        
        # Nếu là quarterly, nhân 4 để ước tính annual
        if row['period_type'] == 'quarterly':
            net_profit = net_profit * 4
        
        eps = net_profit / shares if shares > 0 else 0
        bvps = (row['total_equity'] or 0) / shares if shares > 0 else 0
        
        # Tính growth rate trung bình 5 năm
        growth_query = """
        SELECT 
            AVG(growth) as avg_growth
        FROM (
            SELECT 
                (i2.net_profit - i1.net_profit) * 100.0 / NULLIF(i1.net_profit, 0) as growth
            FROM income_statements i1
            JOIN income_statements i2 ON i1.company_id = i2.company_id 
                AND i2.period_year = i1.period_year + 1
            JOIN companies c ON c.id = i1.company_id
            WHERE c.ticker = :ticker
                AND i1.period_type = 'annual'
            ORDER BY i1.period_year DESC
            LIMIT 5
        )
        """
        growth_df = pd.read_sql(text(growth_query), self.engine, params={"ticker": ticker})
        avg_growth = growth_df['avg_growth'].iloc[0] if not growth_df.empty and growth_df['avg_growth'].iloc[0] is not None else 10  # Default 10%
        
        # Tính FCF (Free Cash Flow)
        fcf = (row['operating_cash_flow'] or 0) + (row['capex'] or 0)  # capex is negative
        
        # Nếu là quarterly, nhân 4 để ước tính annual
        if row['period_type'] == 'quarterly':
            fcf = fcf * 4
            revenue = (row['revenue'] or 0) * 4
        else:
            revenue = row['revenue'] or 0
        
        # Convert numpy types to native Python types for JSON serialization
        return {
            "ticker": str(row['ticker']),
            "current_price": float(row['current_price'] or 0),
            "eps": float(round(eps, 2)),
            "bvps": float(round(bvps, 2)),
            "dividend_per_share": 0,  # Not available in current schema
            "avg_growth_rate": float(round(avg_growth or 10, 2)),
            "fcf": int(fcf),
            "shares_outstanding": int(shares),
            "revenue": int(revenue),
            "net_profit": int(net_profit),
            "total_equity": int(row['total_equity'] or 0),
            "total_assets": int(row['total_assets'] or 0),
            "period_type": str(row['period_type']),
            "period_year": int(row['period_year']),
        }


# Singleton instance
db_manager = DatabaseManager()


def get_db():
    """Get database manager instance"""
    return db_manager
