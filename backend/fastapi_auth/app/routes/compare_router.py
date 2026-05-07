from fastapi import APIRouter, Body
from backend.database import get_db

db = get_db()

router = APIRouter(prefix="/api", tags=["compare"])

@router.post('/compare')
def compare_companies(payload: dict = Body(...)):
    """So sánh các công ty"""
    tickers = payload.get('tickers', [])
    if not tickers:
        return {'companies': []}

    companies = []
    for ticker in tickers:
        symbol = str(ticker).upper().strip()
        if not symbol:
            continue

        company = db.get_company_by_ticker(symbol)
        summary = db.get_financial_summary(symbol)

        if summary is None or summary.empty:
            latest = None
            prev = None
        else:
            latest = summary.iloc[-1]
            prev = summary.iloc[-2] if len(summary) >= 2 else None

        revenue_growth = None
        profit_growth = None
        if latest is not None and prev is not None:
            prev_revenue = prev.get('revenue')
            prev_profit = prev.get('net_profit')
            if prev_revenue not in (None, 0):
                revenue_growth = (latest.get('revenue', 0) - prev_revenue) / prev_revenue * 100
            if prev_profit not in (None, 0):
                profit_growth = (latest.get('net_profit', 0) - prev_profit) / prev_profit * 100

        ratios = {
            'pe_ratio': latest.get('pe_ratio') if latest is not None else None,
            'pb_ratio': latest.get('pb_ratio') if latest is not None else None,
            'roe': latest.get('roe') if latest is not None else None,
            'roa': latest.get('roa') if latest is not None else None,
            'debt_to_equity': latest.get('de_ratio') if latest is not None else None,
            'current_ratio': latest.get('current_ratio') if latest is not None else None,
            'gross_margin': latest.get('gross_margin') if latest is not None else None,
            'net_margin': latest.get('net_margin') if latest is not None else None,
            'revenue_growth': revenue_growth,
            'profit_growth': profit_growth,
        }

        companies.append({
            'ticker': symbol,
            'name': company.get('name') if company else symbol,
            'industry': company.get('industry') if company else None,
            'market_cap': company.get('market_cap') if company else None,
            'price': company.get('current_price') if company else None,
            'ratios': ratios,
        })

    return {'companies': companies}
