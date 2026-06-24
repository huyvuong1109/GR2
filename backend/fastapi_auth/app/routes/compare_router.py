from fastapi import APIRouter, Body, HTTPException
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["compare"])

class CompareRequest(BaseModel):
    tickers: List[str]

@router.post('/compare')
async def compare_companies(request: CompareRequest):
    """
    So sánh 2-5 công ty theo các chỉ số tài chính
    Body: {"tickers": ["VNM", "FPT", "VIC"]}
    """
    tickers = request.tickers
    
    if len(tickers) < 2:
        raise HTTPException(status_code=400, detail="Cần ít nhất 2 mã để so sánh")
    if len(tickers) > 5:
        raise HTTPException(status_code=400, detail="Tối đa 5 mã")
    
    from backend.financial_analysis import (
        calculate_financial_ratios,
        calculate_piotroski_f_score,
        calculate_health_score,
        detect_risk_warnings,
    )
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from Database.models import Company, BalanceSheet, IncomeStatement, CashFlow
    from backend.config import DATABASE_URL
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        results = []
        
        for ticker in tickers:
            company = session.query(Company).filter(Company.ticker == ticker.upper()).first()
            if not company:
                continue
            
            balance = session.query(BalanceSheet).filter(
                BalanceSheet.company_id == company.id
            ).order_by(BalanceSheet.period_year.desc(), BalanceSheet.period_quarter.desc()).first()
            
            income_list = session.query(IncomeStatement).filter(
                IncomeStatement.company_id == company.id
            ).order_by(IncomeStatement.period_year.desc(), IncomeStatement.period_quarter.desc()).limit(2).all()
            
            cash_flow = session.query(CashFlow).filter(
                CashFlow.company_id == company.id
            ).order_by(CashFlow.period_year.desc(), CashFlow.period_quarter.desc()).first()
            
            income = income_list[0] if income_list else None
            prev_income = income_list[1] if len(income_list) > 1 else None
            
            ratios = calculate_financial_ratios(company, balance, income, prev_income, None)
            
            # Get F-Score
            prev_balance = session.query(BalanceSheet).filter(
                BalanceSheet.company_id == company.id,
                BalanceSheet.period_year == (balance.period_year - 1 if balance else 2024)
            ).first()
            
            f_score = calculate_piotroski_f_score(
                balance, prev_balance, income, prev_income, cash_flow,
                company.shares_outstanding or 0
            )
            
            results.append({
                "ticker": ticker.upper(),
                "name": company.name,
                "company_type": company.company_type,
                "industry": company.industry,
                "price": company.current_price,
                "market_cap": company.market_cap,
                "f_score": f_score['total_score'],
                "ratios": {
                    "roe": ratios.get('roe'),
                    "roa": ratios.get('roa'),
                    "pe_ratio": ratios.get('pe_ratio'),
                    "pb_ratio": ratios.get('pb_ratio'),
                    "debt_to_equity": ratios.get('debt_to_equity'),
                    "current_ratio": ratios.get('current_ratio'),
                    "gross_margin": ratios.get('gross_margin'),
                    "net_margin": ratios.get('net_margin'),
                    "revenue_growth": ratios.get('revenue_growth'),
                    "profit_growth": ratios.get('profit_growth'),
                    "eps": ratios.get('eps'),
                    "bvps": ratios.get('bvps'),
                    "dividend_yield": ratios.get('dividend_yield')
                }
            })
        
        return {
            "companies": results,
            "count": len(results),
            "comparison_metrics": [
                "roe", "roa", "pe_ratio", "pb_ratio", "debt_to_equity",
                "gross_margin", "net_margin", "revenue_growth", "profit_growth",
                "f_score", "eps", "bvps"
            ]
        }
    finally:
        session.close()

@router.get('/compare')
async def compare_companies_get(tickers: str):
    """So sánh công ty (GET method) - tickers ngăn cách bằng dấu phẩy"""
    ticker_list = [t.strip().upper() for t in tickers.split(',')]
    request = CompareRequest(tickers=ticker_list)
    return await compare_companies(request)
