"""
QUERY PHÂN TÍCH TÀI CHÍNH - ĐỌC TỪ DB 4 BẢNG
Chạy local trên máy tính sau khi download DB từ Kaggle
"""
import sqlite3
import pandas as pd
import os

# ==============================================================================
# CẤU HÌNH
# ==============================================================================
db_path        = r"D:\X1G8\GR2\FinancialApp\Database\master_db\master.db"   # ← Đổi đường dẫn
TICKER_TO_TEST = 'AAA'                                         # ← Đổi mã CK

# ==============================================================================
# KẾT NỐI DB
# ==============================================================================
if not os.path.exists(db_path):
    print(f"❌ Không tìm thấy DB tại: {db_path}")
    exit()

conn = sqlite3.connect(db_path)
print(f"📁 DB: {db_path}")

# ==============================================================================
# KIỂM TRA DB
# ==============================================================================
print("\n📋 Các bảng trong DB:")
tables = pd.read_sql("SELECT name FROM sqlite_master WHERE type='table'", conn)
print(tables.to_string(index=False))

print("\n🏢 Danh sách công ty đã có:")
companies = pd.read_sql("SELECT ticker, name, industry_type FROM companies", conn)
print(companies.to_string(index=False))

# ==============================================================================
# QUERY CHÍNH — JOIN 4 BẢNG
# ==============================================================================
query = f"""
SELECT
    i.year, i.quarter,

    -- KẾT QUẢ KINH DOANH
    i.revenue,
    i.cogs,
    i.gross_profit,
    i.net_interest_income,
    i.non_interest_income,
    i.provision_expenses,
    i.brokerage_income,
    i.proprietary_trading,
    i.financial_revenue,
    i.selling_expenses,
    i.admin_expenses,
    i.operating_expenses,
    i.pre_tax_profit,
    i.net_profit,
    i.net_profit_parent,

    -- CÂN ĐỐI KẾ TOÁN
    b.total_assets,
    b.cash_and_equivalents,
    b.short_term_investments,
    b.inventory,
    b.receivables,
    b.fixed_assets,
    b.prepayments_from_customers,
    b.loans_to_customers,
    b.trading_securities,
    b.margin_loans,
    b.short_term_debt,
    b.long_term_debt,
    b.total_liabilities,
    b.deposits_from_customers,
    b.total_equity,

    -- LƯU CHUYỂN TIỀN TỆ
    c.operating_cash_flow,
    c.investing_cash_flow,
    c.financing_cash_flow,
    c.capex,
    c.dividends_paid

FROM companies comp
JOIN income_statements i ON comp.id = i.company_id
JOIN balance_sheets    b ON comp.id = b.company_id AND i.year = b.year AND i.quarter = b.quarter
JOIN cash_flows        c ON comp.id = c.company_id AND i.year = c.year AND i.quarter = c.quarter
WHERE comp.ticker = '{TICKER_TO_TEST}'
ORDER BY i.year ASC, i.quarter ASC
"""

try:
    df = pd.read_sql(query, conn)
except Exception as e:
    print(f"\n❌ Lỗi query: {e}")
    conn.close()
    exit()

if df.empty:
    print(f"\n⚠️  Không có dữ liệu cho {TICKER_TO_TEST}")
    conn.close()
    exit()

# ==============================================================================
# HIỂN THỊ — PIVOT THEO QUÝ
# ==============================================================================
df['ky'] = 'Q' + df['quarter'].astype(str) + '/' + df['year'].astype(str)

rename_dict = {
    # Kết quả kinh doanh
    'revenue':              '01. Doanh thu thuần (Non-bank)',
    'cogs':                 '02. Giá vốn hàng bán',
    'gross_profit':         '03. Lợi nhuận gộp',
    'net_interest_income':  '04. Thu nhập lãi thuần (Bank)',
    'non_interest_income':  '05. Thu nhập ngoài lãi (Bank)',
    'provision_expenses':   '06. Chi phí dự phòng (Bank)',
    'brokerage_income':     '07. Doanh thu môi giới (CK)',
    'proprietary_trading':  '08. Tự doanh/FVTPL (CK)',
    'financial_revenue':    '09. Doanh thu tài chính',
    'selling_expenses':     '10. Chi phí bán hàng',
    'admin_expenses':       '11. Chi phí quản lý',
    'operating_expenses':   '12. Tổng chi phí HĐ',
    'pre_tax_profit':       '13. Lợi nhuận trước thuế',
    'net_profit':           '14. Lợi nhuận sau thuế',
    'net_profit_parent':    '15. LNST Cổ đông mẹ',
    # Cân đối kế toán
    'total_assets':                '16. TỔNG TÀI SẢN',
    'cash_and_equivalents':        '17. Tiền & Tương đương',
    'short_term_investments':      '18. Đầu tư ngắn hạn',
    'inventory':                   '19. Hàng tồn kho',
    'receivables':                 '20. Phải thu',
    'fixed_assets':                '21. Tài sản cố định',
    'prepayments_from_customers':  '22. Người mua trả trước (BĐS)',
    'loans_to_customers':          '23. Cho vay KH (Bank)',
    'trading_securities':          '24. CK kinh doanh (CK)',
    'margin_loans':                '25. Cho vay margin (CK)',
    'short_term_debt':             '26. Nợ vay ngắn hạn',
    'long_term_debt':              '27. Nợ vay dài hạn',
    'total_liabilities':           '28. TỔNG NỢ PHẢI TRẢ',
    'deposits_from_customers':     '29. Tiền gửi KH (Bank)',
    'total_equity':                '30. VỐN CHỦ SỞ HỮU',
    # Lưu chuyển tiền tệ
    'operating_cash_flow':  '31. Dòng tiền kinh doanh',
    'investing_cash_flow':  '32. Dòng tiền đầu tư',
    'financing_cash_flow':  '33. Dòng tiền tài chính',
    'capex':                '34. Chi đầu tư TSCĐ (Capex)',
    'dividends_paid':       '35. Cổ tức đã trả',
}

value_cols = list(rename_dict.keys())
df_melt    = df.melt(id_vars=['ky'], value_vars=value_cols)
df_melt['variable'] = df_melt['variable'].map(rename_dict)
df_pivot   = df_melt.pivot(index='variable', columns='ky', values='value')
df_pivot   = df_pivot.reindex(list(rename_dict.values()))

# Bỏ hàng toàn 0 (không liên quan đến ngành này)
df_pivot = df_pivot.loc[(df_pivot != 0).any(axis=1)]

pd.options.display.float_format = '{:,.0f}'.format
pd.set_option('display.max_columns', None)
pd.set_option('display.width', 200)

print(f"\n{'='*80}")
print(f"  BÁO CÁO TÀI CHÍNH TỔNG HỢP: {TICKER_TO_TEST}")
print(f"{'='*80}")
print(df_pivot.to_string())

conn.close()