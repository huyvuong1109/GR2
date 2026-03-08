"""
Seed Sample Data - Tạo dữ liệu mẫu cho chương trình demo
Phù hợp với schema database hiện tại
"""
import random
import sqlite3
import os

# Đường dẫn database
DB_PATH = os.path.join(os.path.dirname(__file__), 'master_db', 'master.db')

# Danh sách công ty mẫu
SAMPLE_COMPANIES = [
    {"ticker": "VNM", "name": "Công ty CP Sữa Việt Nam", "industry": "Thực phẩm & Đồ uống"},
    {"ticker": "VCB", "name": "Ngân hàng TMCP Ngoại Thương VN", "industry": "Ngân hàng"},
    {"ticker": "HPG", "name": "Công ty CP Tập đoàn Hòa Phát", "industry": "Thép"},
    {"ticker": "MWG", "name": "Công ty CP Đầu tư Thế Giới Di Động", "industry": "Bán lẻ"},
    {"ticker": "VHM", "name": "Công ty CP Vinhomes", "industry": "Bất động sản"},
    {"ticker": "TCB", "name": "Ngân hàng TMCP Kỹ Thương VN", "industry": "Ngân hàng"},
    {"ticker": "MSN", "name": "Công ty CP Tập đoàn Masan", "industry": "Đa ngành"},
    {"ticker": "ACB", "name": "Ngân hàng TMCP Á Châu", "industry": "Ngân hàng"},
    {"ticker": "VRE", "name": "CTCP Vincom Retail", "industry": "Bất động sản"},
    {"ticker": "PNJ", "name": "CTCP Vàng bạc Đá quý Phú Nhuận", "industry": "Bán lẻ"},
    {"ticker": "HSG", "name": "CTCP Tập đoàn Hoa Sen", "industry": "Thép"},
    {"ticker": "DGC", "name": "CTCP Tập đoàn Hóa chất Đức Giang", "industry": "Hóa chất"},
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
    
    shares = int(random.uniform(500, 3000) * 1_000_000)
    
    # Generate 11 years of annual data (2015-2025)
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
        financial_exp = int(revenue * random.uniform(0.01, 0.03))
        interest_exp = int(financial_exp * 0.8)
        
        profit_before_tax = operating_income - financial_exp
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
        short_term_inv = int(cash * random.uniform(0.2, 0.5))
        
        current_liabilities = int(total_debt * random.uniform(0.4, 0.6))
        short_term_debt = int(current_liabilities * random.uniform(0.3, 0.5))
        non_current_liabilities = total_debt - current_liabilities
        long_term_debt = int(non_current_liabilities * random.uniform(0.6, 0.9))
        
        non_current_assets = total_assets - current_assets
        fixed_assets = int(non_current_assets * random.uniform(0.5, 0.7))
        
        retained_earnings = int(total_equity * random.uniform(0.3, 0.5))
        
        # Dividend
        dividend_ratio = random.uniform(0.2, 0.5) if net_profit > 0 else 0
        
        # Balance Sheet record - matching actual DB schema
        bs = {
            'company_id': company_id,
            'period_type': 'annual',
            'period_year': year,
            'period_quarter': None,
            'raw_data': None,
            'total_assets': total_assets,
            'current_assets': current_assets,
            'cash_and_equivalents': cash,
            'short_term_investments': short_term_inv,
            'accounts_receivable': receivables,
            'inventories': inventory,
            'non_current_assets': non_current_assets,
            'fixed_assets': fixed_assets,
            'total_liabilities': total_debt,
            'current_liabilities': current_liabilities,
            'short_term_debt': short_term_debt,
            'non_current_liabilities': non_current_liabilities,
            'long_term_debt': long_term_debt,
            'total_equity': total_equity,
            'retained_earnings': retained_earnings
        }
        balance_sheets.append(bs)
        
        # Income Statement record - matching actual DB schema
        inc = {
            'company_id': company_id,
            'period_type': 'annual',
            'period_year': year,
            'period_quarter': None,
            'raw_data': None,
            'revenue': revenue,
            'cost_of_goods_sold': cogs,
            'gross_profit': gross_profit,
            'selling_expenses': selling_exp,
            'admin_expenses': admin_exp,
            'operating_income': operating_income,
            'financial_expenses': financial_exp,
            'interest_expenses': interest_exp,
            'profit_before_tax': profit_before_tax,
            'net_profit': net_profit,
            'net_profit_to_shareholders': int(net_profit * random.uniform(0.95, 1.0))
        }
        income_statements.append(inc)
        
        # Cash Flow record - matching actual DB schema
        operating_cf = int(net_profit * random.uniform(0.9, 1.3))
        capex = -int(revenue * random.uniform(0.03, 0.08))
        investing_cf = capex - int(revenue * random.uniform(0.01, 0.05))
        financing_cf = int(revenue * random.uniform(-0.05, 0.05))
        dividends = -int(net_profit * dividend_ratio) if net_profit > 0 else 0
        
        cf = {
            'company_id': company_id,
            'period_type': 'annual',
            'period_year': year,
            'period_quarter': None,
            'raw_data': None,
            'operating_cash_flow': operating_cf,
            'investing_cash_flow': investing_cf,
            'capex': capex,
            'financing_cash_flow': financing_cf,
            'dividends_paid': dividends,
            'ending_cash': cash
        }
        cash_flows.append(cf)
    
    price = net_profit / shares * random.uniform(8, 15) if shares > 0 and net_profit > 0 else random.uniform(10, 50)
    
    return balance_sheets, income_statements, cash_flows, shares, price


def seed_database():
    """Seed the database with sample data"""
    print("🔄 Connecting to database...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check existing companies
    cursor.execute("SELECT ticker FROM companies")
    existing_tickers = set(row[0] for row in cursor.fetchall())
    print(f"   Existing companies: {existing_tickers}")
    
    companies_added = 0
    
    for company_data in SAMPLE_COMPANIES:
        ticker = company_data["ticker"]
        
        if ticker in existing_tickers:
            print(f"   ⏭️  {ticker} already exists, skipping...")
            continue
        
        print(f"   📊 Creating data for {ticker} - {company_data['name']}...")
        
        # Insert company
        cursor.execute("""
            INSERT INTO companies (ticker, name, industry, market_cap, shares_outstanding, current_price)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (ticker, company_data["name"], company_data["industry"], 0, 0, 0))
        
        company_id = cursor.lastrowid
        
        # Generate financial data
        balance_sheets, income_statements, cash_flows, shares, price = generate_financial_data(
            company_id, ticker, company_data["industry"]
        )
        
        # Update company with shares and price
        market_cap = int(shares * price)
        cursor.execute("""
            UPDATE companies SET shares_outstanding = ?, current_price = ?, market_cap = ?
            WHERE id = ?
        """, (shares, round(price, 2), market_cap, company_id))
        
        # Insert balance sheets
        for bs in balance_sheets:
            cursor.execute("""
                INSERT INTO balance_sheets (
                    company_id, period_type, period_year, period_quarter, raw_data,
                    total_assets, current_assets, cash_and_equivalents, short_term_investments,
                    accounts_receivable, inventories, non_current_assets, fixed_assets,
                    total_liabilities, current_liabilities, short_term_debt,
                    non_current_liabilities, long_term_debt, total_equity, retained_earnings
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                bs['company_id'], bs['period_type'], bs['period_year'], bs['period_quarter'], bs['raw_data'],
                bs['total_assets'], bs['current_assets'], bs['cash_and_equivalents'], bs['short_term_investments'],
                bs['accounts_receivable'], bs['inventories'], bs['non_current_assets'], bs['fixed_assets'],
                bs['total_liabilities'], bs['current_liabilities'], bs['short_term_debt'],
                bs['non_current_liabilities'], bs['long_term_debt'], bs['total_equity'], bs['retained_earnings']
            ))
        
        # Insert income statements
        for inc in income_statements:
            cursor.execute("""
                INSERT INTO income_statements (
                    company_id, period_type, period_year, period_quarter, raw_data,
                    revenue, cost_of_goods_sold, gross_profit, selling_expenses, admin_expenses,
                    operating_income, financial_expenses, interest_expenses,
                    profit_before_tax, net_profit, net_profit_to_shareholders
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                inc['company_id'], inc['period_type'], inc['period_year'], inc['period_quarter'], inc['raw_data'],
                inc['revenue'], inc['cost_of_goods_sold'], inc['gross_profit'], inc['selling_expenses'], inc['admin_expenses'],
                inc['operating_income'], inc['financial_expenses'], inc['interest_expenses'],
                inc['profit_before_tax'], inc['net_profit'], inc['net_profit_to_shareholders']
            ))
        
        # Insert cash flows
        for cf in cash_flows:
            cursor.execute("""
                INSERT INTO cash_flows (
                    company_id, period_type, period_year, period_quarter, raw_data,
                    operating_cash_flow, investing_cash_flow, capex,
                    financing_cash_flow, dividends_paid, ending_cash
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                cf['company_id'], cf['period_type'], cf['period_year'], cf['period_quarter'], cf['raw_data'],
                cf['operating_cash_flow'], cf['investing_cash_flow'], cf['capex'],
                cf['financing_cash_flow'], cf['dividends_paid'], cf['ending_cash']
            ))
        
        companies_added += 1
    
    conn.commit()
    
    # Show summary
    cursor.execute("SELECT COUNT(*) FROM companies")
    total_companies = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM balance_sheets")
    total_bs = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM income_statements")
    total_is = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM cash_flows")
    total_cf = cursor.fetchone()[0]
    
    conn.close()
    
    print("\n" + "=" * 50)
    print("✅ Database seeded successfully!")
    print("=" * 50)
    print(f"   📈 Companies added: {companies_added}")
    print(f"   📊 Total companies: {total_companies}")
    print(f"   📋 Balance Sheets: {total_bs}")
    print(f"   📋 Income Statements: {total_is}")
    print(f"   📋 Cash Flows: {total_cf}")
    print("=" * 50)


if __name__ == "__main__":
    seed_database()
