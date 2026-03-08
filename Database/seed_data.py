"""
Seed Data - Tạo dữ liệu mẫu cho 10 năm báo cáo tài chính
"""
import random
from datetime import date
from models import (
    Company, BalanceSheet, IncomeStatement, CashFlow,
    init_db, get_session
)
import sys
sys.path.append('..')
from backend.config import DATABASE_URL

# Danh sách công ty mẫu
SAMPLE_COMPANIES = [
    {"ticker": "VNM", "name": "Công ty CP Sữa Việt Nam", "industry": "Thực phẩm & Đồ uống", "exchange": "HOSE"},
    {"ticker": "FPT", "name": "Công ty CP FPT", "industry": "Công nghệ thông tin", "exchange": "HOSE"},
    {"ticker": "VCB", "name": "Ngân hàng TMCP Ngoại Thương VN", "industry": "Ngân hàng", "exchange": "HOSE"},
    {"ticker": "HPG", "name": "Công ty CP Tập đoàn Hòa Phát", "industry": "Thép", "exchange": "HOSE"},
    {"ticker": "MWG", "name": "Công ty CP Đầu tư Thế Giới Di Động", "industry": "Bán lẻ", "exchange": "HOSE"},
    {"ticker": "VHM", "name": "Công ty CP Vinhomes", "industry": "Bất động sản", "exchange": "HOSE"},
    {"ticker": "TCB", "name": "Ngân hàng TMCP Kỹ Thương VN", "industry": "Ngân hàng", "exchange": "HOSE"},
    {"ticker": "MSN", "name": "Công ty CP Tập đoàn Masan", "industry": "Đa ngành", "exchange": "HOSE"},
    {"ticker": "VIC", "name": "Tập đoàn Vingroup", "industry": "Bất động sản", "exchange": "HOSE"},
    {"ticker": "ACB", "name": "Ngân hàng TMCP Á Châu", "industry": "Ngân hàng", "exchange": "HOSE"},
    {"ticker": "VRE", "name": "CTCP Vincom Retail", "industry": "Bất động sản", "exchange": "HOSE"},
    {"ticker": "PNJ", "name": "CTCP Vàng bạc Đá quý Phú Nhuận", "industry": "Bán lẻ", "exchange": "HOSE"},
    {"ticker": "REE", "name": "CTCP Cơ điện lạnh", "industry": "Công nghiệp", "exchange": "HOSE"},
    {"ticker": "DHG", "name": "CTCP Dược Hậu Giang", "industry": "Dược phẩm", "exchange": "HOSE"},
    {"ticker": "DGC", "name": "CTCP Tập đoàn Hóa chất Đức Giang", "industry": "Hóa chất", "exchange": "HOSE"},
]


def generate_financial_data(company_id: int, ticker: str, industry: str):
    """Generate 10 years of financial data for a company"""
    balance_sheets = []
    income_statements = []
    cash_flows = []
    
    # Base parameters vary by industry
    industry_params = {
        "Ngân hàng": {"revenue_base": 30000, "margin": 0.35, "de_ratio": 8.0, "growth": 0.12},
        "Công nghệ thông tin": {"revenue_base": 25000, "margin": 0.15, "de_ratio": 0.3, "growth": 0.18},
        "Thực phẩm & Đồ uống": {"revenue_base": 55000, "margin": 0.40, "de_ratio": 0.4, "growth": 0.08},
        "Thép": {"revenue_base": 90000, "margin": 0.12, "de_ratio": 0.7, "growth": 0.10},
        "Bán lẻ": {"revenue_base": 100000, "margin": 0.20, "de_ratio": 0.6, "growth": 0.15},
        "Bất động sản": {"revenue_base": 40000, "margin": 0.30, "de_ratio": 0.8, "growth": 0.12},
        "Dược phẩm": {"revenue_base": 4000, "margin": 0.45, "de_ratio": 0.25, "growth": 0.10},
        "Hóa chất": {"revenue_base": 8000, "margin": 0.25, "de_ratio": 0.35, "growth": 0.14},
        "Đa ngành": {"revenue_base": 60000, "margin": 0.15, "de_ratio": 0.9, "growth": 0.10},
        "Công nghiệp": {"revenue_base": 6000, "margin": 0.22, "de_ratio": 0.45, "growth": 0.08},
    }
    
    params = industry_params.get(industry, {"revenue_base": 10000, "margin": 0.15, "de_ratio": 0.5, "growth": 0.10})
    
    # Generate 10 years of annual data (2015-2024)
    for year in range(2015, 2026):
        year_offset = year - 2015
        random_factor = random.uniform(0.9, 1.1)
        
        # Revenue grows over time with some variation
        base_growth = (1 + params["growth"]) ** year_offset
        revenue = int(params["revenue_base"] * base_growth * random_factor * 1_000_000_000)
        
        # Cost and profit calculations
        gross_margin = params["margin"] * random.uniform(0.95, 1.05)
        cogs = int(revenue * (1 - gross_margin))
        gross_profit = revenue - cogs
        
        selling_exp = int(revenue * random.uniform(0.05, 0.08))
        admin_exp = int(revenue * random.uniform(0.03, 0.05))
        operating_income = gross_profit - selling_exp - admin_exp
        
        # Financial items
        financial_income = int(revenue * random.uniform(0.005, 0.02))
        financial_exp = int(revenue * random.uniform(0.01, 0.03))
        interest_exp = int(financial_exp * 0.8)
        
        profit_before_tax = operating_income + financial_income - financial_exp
        tax = int(profit_before_tax * 0.20) if profit_before_tax > 0 else 0
        net_profit = profit_before_tax - tax
        
        # Balance Sheet
        total_equity = int(net_profit * random.uniform(4, 6))
        total_debt = int(total_equity * params["de_ratio"] * random.uniform(0.8, 1.2))
        total_assets = total_equity + total_debt
        
        current_assets = int(total_assets * random.uniform(0.35, 0.55))
        cash = int(current_assets * random.uniform(0.15, 0.30))
        receivables = int(current_assets * random.uniform(0.25, 0.35))
        inventory = int(current_assets * random.uniform(0.20, 0.35))
        
        current_liabilities = int(total_debt * random.uniform(0.4, 0.6))
        short_term_debt = int(current_liabilities * random.uniform(0.3, 0.5))
        
        # Shares outstanding (in millions, then converted)
        shares = int(random.uniform(300, 2000) * 1_000_000)
        price = net_profit / shares * random.uniform(8, 15) if shares > 0 else 0
        
        # Dividend
        dividend_ratio = random.uniform(0.2, 0.5) if net_profit > 0 else 0
        dps = (net_profit * dividend_ratio / shares) if shares > 0 else 0
        
        # Balance Sheet record
        bs = BalanceSheet(
            company_id=company_id,
            period_type='annual',
            period_year=year,
            period_quarter=None,
            report_date=date(year, 12, 31),
            total_assets=total_assets,
            current_assets=current_assets,
            cash_and_equivalents=cash,
            short_term_investments=int(cash * random.uniform(0.2, 0.5)),
            accounts_receivable=receivables,
            inventories=inventory,
            other_current_assets=current_assets - cash - receivables - inventory,
            non_current_assets=total_assets - current_assets,
            fixed_assets=int((total_assets - current_assets) * random.uniform(0.5, 0.7)),
            long_term_investments=int((total_assets - current_assets) * random.uniform(0.1, 0.3)),
            total_liabilities=total_debt,
            current_liabilities=current_liabilities,
            short_term_debt=short_term_debt,
            accounts_payable=int(current_liabilities * random.uniform(0.3, 0.5)),
            non_current_liabilities=total_debt - current_liabilities,
            long_term_debt=int((total_debt - current_liabilities) * random.uniform(0.6, 0.9)),
            total_equity=total_equity,
            share_capital=int(total_equity * random.uniform(0.3, 0.5)),
            retained_earnings=int(total_equity * random.uniform(0.3, 0.5))
        )
        balance_sheets.append(bs)
        
        # Income Statement record
        inc = IncomeStatement(
            company_id=company_id,
            period_type='annual',
            period_year=year,
            period_quarter=None,
            report_date=date(year, 12, 31),
            revenue=revenue,
            cost_of_goods_sold=cogs,
            gross_profit=gross_profit,
            selling_expenses=selling_exp,
            admin_expenses=admin_exp,
            operating_income=operating_income,
            financial_income=financial_income,
            financial_expenses=financial_exp,
            interest_expenses=interest_exp,
            other_income=int(revenue * random.uniform(0.001, 0.01)),
            other_expenses=int(revenue * random.uniform(0.001, 0.005)),
            profit_before_tax=profit_before_tax,
            income_tax=tax,
            net_profit=net_profit,
            net_profit_to_shareholders=int(net_profit * random.uniform(0.95, 1.0)),
            dividend_per_share=round(dps, 0)
        )
        income_statements.append(inc)
        
        # Cash Flow record
        operating_cf = int(net_profit * random.uniform(0.9, 1.3))
        capex = int(revenue * random.uniform(0.03, 0.08))
        
        cf = CashFlow(
            company_id=company_id,
            period_type='annual',
            period_year=year,
            period_quarter=None,
            report_date=date(year, 12, 31),
            operating_cash_flow=operating_cf,
            depreciation=int(capex * random.uniform(0.8, 1.2)),
            change_in_working_capital=int(operating_cf * random.uniform(-0.2, 0.2)),
            investing_cash_flow=-capex - int(revenue * random.uniform(0.01, 0.05)),
            capex=-capex,
            investments=int(revenue * random.uniform(-0.03, 0.02)),
            financing_cash_flow=int(revenue * random.uniform(-0.05, 0.05)),
            debt_issued=int(total_debt * random.uniform(0.05, 0.15)),
            debt_repaid=int(total_debt * random.uniform(0.05, 0.12)),
            dividends_paid=-int(net_profit * dividend_ratio) if net_profit > 0 else 0,
            share_issuance=int(total_equity * random.uniform(0, 0.05)),
            net_change_in_cash=int(cash * random.uniform(-0.1, 0.15)),
            beginning_cash=int(cash * random.uniform(0.85, 1.0)),
            ending_cash=cash
        )
        cash_flows.append(cf)
    
    return balance_sheets, income_statements, cash_flows, shares, price


def seed_database():
    """Seed the database with sample data"""
    print("Initializing database...")
    engine = init_db(DATABASE_URL)
    session = get_session(engine)
    
    # Clear existing data
    session.query(CashFlow).delete()
    session.query(IncomeStatement).delete()
    session.query(BalanceSheet).delete()
    session.query(Company).delete()
    session.commit()
    
    print("Creating sample companies and financial data...")
    
    for company_data in SAMPLE_COMPANIES:
        # Create company
        company = Company(
            ticker=company_data["ticker"],
            name=company_data["name"],
            industry=company_data["industry"],
            exchange=company_data["exchange"]
        )
        session.add(company)
        session.flush()  # Get the company ID
        
        # Generate financial data
        balance_sheets, income_statements, cash_flows, shares, price = generate_financial_data(
            company.id, company_data["ticker"], company_data["industry"]
        )
        
        # Update company with shares and price
        company.shares_outstanding = shares
        company.current_price = round(price, 2)
        company.market_cap = int(shares * price)
        
        # Add financial records
        for bs in balance_sheets:
            session.add(bs)
        for inc in income_statements:
            session.add(inc)
        for cf in cash_flows:
            session.add(cf)
        
        print(f"  Created data for {company_data['ticker']} - {company_data['name']}")
    
    session.commit()
    session.close()
    
    print("\n✅ Database seeded successfully!")
    print(f"   - {len(SAMPLE_COMPANIES)} companies")
    print(f"   - 11 years of annual data per company (2015-2025)")


if __name__ == "__main__":
    seed_database()
