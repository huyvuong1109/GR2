from fastapi import APIRouter, HTTPException, Query
import sqlite3
from pathlib import Path
from backend.database import get_db, _resolve_industry

router = APIRouter(prefix="/api/companies", tags=["companies"])
BASE = Path(__file__).resolve().parents[4]
ANALYTICS_DB = BASE / 'Database' / 'master_db' / 'analytics(final).db'
db = get_db()

def get_company_from_db(ticker: str):
    """Get company data from database"""
    if not ANALYTICS_DB.exists():
        return None
    
    conn = sqlite3.connect(str(ANALYTICS_DB))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        "SELECT id, ticker, name, company_type, industry, current_price, market_cap, shares_outstanding, description FROM companies WHERE UPPER(ticker)=?",
        (ticker.upper(),)
    )
    row = cur.fetchone()
    
    if not row:
        conn.close()
        return None
        
    company = dict(row)
    company["industry"] = _resolve_industry(
        company.get("ticker"),
        company.get("industry"),
        company.get("company_type"),
    )
    
    # Fetch officers
    cur.execute(
        "SELECT name, position, position_en, from_date FROM company_officers WHERE UPPER(ticker)=?",
        (ticker.upper(),)
    )
    officers = [dict(o) for o in cur.fetchall()]
    company["officers"] = officers
    
    conn.close()
    return company

@router.get('')
def list_companies(limit: int = 100):
    """Danh sách công ty (phân trang)"""
    if not ANALYTICS_DB.exists():
        raise HTTPException(500, 'Analytics DB không tồn tại')
    
    conn = sqlite3.connect(str(ANALYTICS_DB))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT id, ticker, name, company_type, industry, current_price, market_cap, shares_outstanding FROM companies LIMIT ?", (limit,))
    rows = cur.fetchall()
    conn.close()

    results = []
    for row in rows:
        company = dict(row)
        company["industry"] = _resolve_industry(
            company.get("ticker"),
            company.get("industry"),
            company.get("company_type"),
        )
        results.append(company)

    return results


@router.get('/search')
def search_companies(q: str = Query(..., min_length=1, description="Search query")):
    """Tìm kiếm công ty theo mã CK hoặc tên"""
    if not ANALYTICS_DB.exists():
        raise HTTPException(500, 'Analytics DB không tồn tại')

    query = f"%{q.strip().upper()}%"
    conn = sqlite3.connect(str(ANALYTICS_DB))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, ticker, name, company_type, industry, current_price, market_cap, shares_outstanding
        FROM companies
        WHERE UPPER(ticker) LIKE ? OR UPPER(name) LIKE ?
        ORDER BY market_cap DESC
        LIMIT 10
        """,
        (query, query),
    )
    rows = cur.fetchall()
    conn.close()

    results = []
    for row in rows:
        company = dict(row)
        company["industry"] = _resolve_industry(
            company.get("ticker"),
            company.get("industry"),
            company.get("company_type"),
        )
        results.append(company)

    return {
        "query": q,
        "count": len(results),
        "results": results,
    }

@router.get('/batch')
def get_companies_batch(tickers: str = Query(...)):
    """Lấy danh sách công ty theo tickers (cách nhau bằng dấu phẩy)"""
    if not ANALYTICS_DB.exists():
        raise HTTPException(500, 'Analytics DB không tồn tại')

    ticker_list = [t.strip().upper() for t in tickers.split(',') if t.strip()]
    if not ticker_list:
        return []

    placeholders = ','.join('?' * len(ticker_list))
    conn = sqlite3.connect(str(ANALYTICS_DB))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        f"SELECT id, ticker, name, company_type, industry, current_price, market_cap, shares_outstanding FROM companies WHERE UPPER(ticker) IN ({placeholders})",
        ticker_list
    )
    rows = cur.fetchall()
    conn.close()

    results = []
    for row in rows:
        company = dict(row)
        company["industry"] = _resolve_industry(
            company.get("ticker"),
            company.get("industry"),
            company.get("company_type"),
        )
        results.append(company)

    return results

@router.get('/{ticker}')
def get_company(ticker: str):
    """Lấy thông tin công ty theo mã"""
    company = get_company_from_db(ticker)
    if company:
        return company
    raise HTTPException(404, f'Không tìm thấy công ty {ticker}')


@router.get('/{ticker}/balance-sheets')
def get_company_balance_sheets(ticker: str):
    """Lấy danh sách báo cáo cân đối kế toán đã map theo loại công ty"""
    return db.get_company_balance_sheets_mapped(ticker.upper())


@router.get('/{ticker}/income-statements')
def get_company_income_statements(ticker: str):
    """Lấy danh sách báo cáo kết quả kinh doanh đã map theo loại công ty"""
    return db.get_company_income_statements_mapped(ticker.upper())


@router.get('/{ticker}/cash-flows')
def get_company_cash_flows(ticker: str):
    """Lấy danh sách báo cáo lưu chuyển tiền tệ đã map theo loại công ty"""
    return db.get_company_cash_flows_mapped(ticker.upper())

# @router.get('/{ticker}/health-score')
# def get_health_score(ticker: str):
#     """Lấy health score của công ty"""
#     company = get_company_from_db(ticker)
#     if not company:
#         raise HTTPException(404, f'Không tìm thấy công ty {ticker}')
#     
#     # Mock health score - có thể upgrade lấy từ financial data
#     company_type = company.get('company_type', '').lower()
#     scores = {
#         'bank': {'score': 8.0, 'rating': 'Very Good', 'trend': 'up'},
#         'securities': {'score': 7.5, 'rating': 'Good', 'trend': 'stable'},
#         'insurance': {'score': 7.8, 'rating': 'Good', 'trend': 'up'},
#         'corporate': {'score': 6.8, 'rating': 'Fair', 'trend': 'stable'}
#     }
#     
#     return scores.get(company_type, {'score': 6.5, 'rating': 'Fair', 'trend': 'stable'})
