from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..db import SessionLocal
from .. import crud
from ..models import Notification
from .user_router import get_current_user
from backend.database import get_db

router = APIRouter(prefix="/api/value", tags=["value"])

analytics_db = get_db()


def get_user_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _compute_intrinsic_value(fcf: float, growth_rate: float, discount_rate: float, years: int):
    if fcf is None or fcf <= 0 or discount_rate <= 0 or years <= 0:
        return None
    growth = growth_rate / 100
    discount = discount_rate / 100
    intrinsic = 0.0
    for year in range(1, years + 1):
        projected = fcf * ((1 + growth) ** year)
        intrinsic += projected / ((1 + discount) ** year)
    return intrinsic


@router.get("/assumptions/{ticker}")
def get_assumptions(ticker: str, current_user=Depends(get_current_user), db: Session = Depends(get_user_db)):
    item = crud.get_intrinsic_assumption(db, current_user.id, ticker.upper())
    if not item:
        return {"ticker": ticker.upper(), "growth_rate": 8, "discount_rate": 12, "years": 5}
    return {
        "ticker": item.ticker,
        "growth_rate": item.growth_rate,
        "discount_rate": item.discount_rate,
        "years": item.years,
    }


@router.put("/assumptions/{ticker}")
def upsert_assumptions(ticker: str, payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_user_db)):
    growth_rate = int(payload.get("growth_rate", 8))
    discount_rate = int(payload.get("discount_rate", 12))
    years = int(payload.get("years", 5))
    item = crud.upsert_intrinsic_assumption(db, current_user.id, ticker.upper(), growth_rate, discount_rate, years)
    return {
        "ticker": item.ticker,
        "growth_rate": item.growth_rate,
        "discount_rate": item.discount_rate,
        "years": item.years,
    }


@router.get("/notes/{ticker}")
def get_note(ticker: str, current_user=Depends(get_current_user), db: Session = Depends(get_user_db)):
    item = crud.get_investment_note(db, current_user.id, ticker.upper())
    if not item:
        return {"ticker": ticker.upper(), "note": ""}
    return {"ticker": item.ticker, "note": item.note, "updated_at": item.updated_at.isoformat()}


@router.put("/notes/{ticker}")
def upsert_note(ticker: str, payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_user_db)):
    note = str(payload.get("note", "")).strip()
    if not note:
        raise HTTPException(400, "Missing note")
    item = crud.upsert_investment_note(db, current_user.id, ticker.upper(), note)
    return {"ticker": item.ticker, "note": item.note, "updated_at": item.updated_at.isoformat()}


@router.get("/watchlist-summary")
def watchlist_summary(current_user=Depends(get_current_user), db: Session = Depends(get_user_db)):
    watchlist_items = crud.list_watchlist(db, current_user.id)
    tickers = [item.ticker for item in watchlist_items]
    if not tickers:
        return []

    companies_df = analytics_db.get_companies_by_tickers(tickers)
    result = []

    for ticker in tickers:
        symbol = ticker.upper()
        company = None
        if not companies_df.empty:
            company_row = companies_df[companies_df["ticker"].str.upper() == symbol]
            if not company_row.empty:
                company = company_row.iloc[0].to_dict()

        metrics = analytics_db.get_long_term_metrics(symbol, 10)
        if metrics.empty:
            continue
        latest = metrics.iloc[-1]

        assumptions = crud.get_intrinsic_assumption(db, current_user.id, symbol)
        growth_rate = assumptions.growth_rate if assumptions else 8
        discount_rate = assumptions.discount_rate if assumptions else 12
        years = assumptions.years if assumptions else 5

        fcf = latest.get("free_cash_flow")
        intrinsic_total = _compute_intrinsic_value(fcf, growth_rate, discount_rate, years)
        shares = latest.get("shares_outstanding")
        intrinsic_per_share = None
        if intrinsic_total is not None and shares and shares > 0:
            intrinsic_per_share = intrinsic_total / shares

        market_price = latest.get("current_price")
        margin = None
        label = None
        if intrinsic_per_share and market_price:
            margin = (intrinsic_per_share - market_price) / intrinsic_per_share
            if margin > 0.15:
                label = "Undervalued"
            elif margin < -0.15:
                label = "Overvalued"
            else:
                label = "Fairly valued"

        result.append({
            "ticker": symbol,
            "name": company.get("name") if company else None,
            "current_price": market_price,
            "intrinsic_value": intrinsic_per_share,
            "margin_of_safety": margin,
            "label": label,
            "metrics": {
                "revenue": latest.get("revenue"),
                "net_income": latest.get("net_profit"),
                "eps": latest.get("eps"),
                "roe": latest.get("roe"),
                "debt": latest.get("debt"),
                "free_cash_flow": latest.get("free_cash_flow"),
            },
        })

    return result


@router.post("/notifications/scan")
def scan_notifications(current_user=Depends(get_current_user), db: Session = Depends(get_user_db)):
    watchlist_items = crud.list_watchlist(db, current_user.id)
    tickers = [item.ticker for item in watchlist_items]
    if not tickers:
        return {"created": 0}

    created = 0
    now = datetime.utcnow()
    recent_cutoff = now - timedelta(days=1)

    for ticker in tickers:
        metrics = analytics_db.get_long_term_metrics(ticker.upper(), 6)
        if metrics.empty:
            continue

        latest = metrics.iloc[-1]
        prev = metrics.iloc[-2] if len(metrics) >= 2 else None

        assumptions = crud.get_intrinsic_assumption(db, current_user.id, ticker.upper())
        growth_rate = assumptions.growth_rate if assumptions else 8
        discount_rate = assumptions.discount_rate if assumptions else 12
        years = assumptions.years if assumptions else 5

        fcf = latest.get("free_cash_flow")
        intrinsic_total = _compute_intrinsic_value(fcf, growth_rate, discount_rate, years)
        shares = latest.get("shares_outstanding")
        intrinsic_per_share = None
        if intrinsic_total is not None and shares and shares > 0:
            intrinsic_per_share = intrinsic_total / shares

        market_price = latest.get("current_price")
        if intrinsic_per_share and market_price and market_price < intrinsic_per_share:
            title = f"{ticker.upper()} dưới giá trị nội tại"
            exists = db.query(Notification).filter(
                Notification.user_id == current_user.id,
                Notification.title == title,
                Notification.created_at >= recent_cutoff,
            ).first()
            if not exists:
                crud.create_notification(
                    db,
                    current_user.id,
                    title,
                    "Giá thị trường đang thấp hơn giá trị nội tại tính theo giả định của bạn.",
                    data=ticker.upper(),
                    ntype="value",
                )
                created += 1

        if prev is not None:
            prev_roe = prev.get("roe") or 0
            latest_roe = latest.get("roe") or 0
            if latest_roe < prev_roe - 5:
                title = f"{ticker.upper()} ROE giảm mạnh"
                exists = db.query(Notification).filter(
                    Notification.user_id == current_user.id,
                    Notification.title == title,
                    Notification.created_at >= recent_cutoff,
                ).first()
                if not exists:
                    crud.create_notification(
                        db,
                        current_user.id,
                        title,
                        "ROE giảm đáng kể so với kỳ trước.",
                        data=ticker.upper(),
                        ntype="warning",
                    )
                    created += 1

            prev_profit = prev.get("net_profit") or 0
            latest_profit = latest.get("net_profit") or 0
            if prev_profit > 0 and (latest_profit - prev_profit) / prev_profit < -0.1:
                title = f"{ticker.upper()} lợi nhuận suy giảm"
                exists = db.query(Notification).filter(
                    Notification.user_id == current_user.id,
                    Notification.title == title,
                    Notification.created_at >= recent_cutoff,
                ).first()
                if not exists:
                    crud.create_notification(
                        db,
                        current_user.id,
                        title,
                        "Lợi nhuận giảm hơn 10% so với kỳ trước.",
                        data=ticker.upper(),
                        ntype="warning",
                    )
                    created += 1

    return {"created": created}
