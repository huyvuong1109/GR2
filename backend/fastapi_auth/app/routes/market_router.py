from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from fastapi import APIRouter

from backend.config import DATABASE_PATH

router = APIRouter(prefix="/api/market", tags=["market"])

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
VCI_CHART_URL = "https://trading.vietcap.com.vn/api/chart/OHLCChart/gap-chart"


def _now_vn() -> datetime:
    return datetime.now(VN_TZ)


def _market_session(now: datetime | None = None) -> dict:
    current = now or _now_vn()
    minutes = current.hour * 60 + current.minute
    is_weekday = current.weekday() < 5
    is_morning = 9 * 60 <= minutes <= 11 * 60 + 30
    is_afternoon = 13 * 60 <= minutes <= 14 * 60 + 45
    is_open = is_weekday and (is_morning or is_afternoon)

    if is_open:
        message = "Thị trường đang mở cửa"
        status = "open"
    elif is_weekday and minutes < 9 * 60:
        message = "Chưa đến giờ giao dịch"
        status = "pre_open"
    elif is_weekday and 11 * 60 + 30 < minutes < 13 * 60:
        message = "Nghỉ giữa phiên"
        status = "break"
    else:
        message = "Thị trường đã đóng cửa"
        status = "closed"

    return {
        "status": status,
        "is_open": is_open,
        "message": message,
        "last_update": current.isoformat(timespec="seconds"),
        "last_update_time": current.strftime("%H:%M"),
    }


def _fetch_index_from_vci(symbol: str = "VNINDEX", count_back: int = 8) -> dict | None:
    """Fetch the latest daily index bars from the public Vietcap chart endpoint."""
    end_time = _now_vn() + timedelta(days=1)
    payload = {
        "timeFrame": "ONE_DAY",
        "symbols": [symbol],
        "to": int(end_time.timestamp()),
        "countBack": count_back,
    }
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9,vi-VN;q=0.8,vi;q=0.7",
        "Connection": "keep-alive",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": "https://trading.vietcap.com.vn/",
        "Origin": "https://trading.vietcap.com.vn/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    }

    response = requests.post(VCI_CHART_URL, json=payload, headers=headers, timeout=8)
    response.raise_for_status()
    data = response.json()

    if isinstance(data, dict):
        data = data.get("data") or []
    if not isinstance(data, list) or not data:
        return None

    series = data[0] if isinstance(data[0], dict) else None
    closes = series.get("c") if series else None
    times = series.get("t") if series else None
    volumes = series.get("v") if series else None
    if not closes:
        return None

    valid = [
        {
            "time": times[index] if times and index < len(times) else None,
            "close": float(close),
            "volume": float(volumes[index]) if volumes and index < len(volumes) and volumes[index] is not None else None,
        }
        for index, close in enumerate(closes)
        if close is not None
    ]
    if not valid:
        return None

    latest = valid[-1]
    previous = valid[-2] if len(valid) > 1 else None
    change = latest["close"] - previous["close"] if previous else None
    change_percent = (change / previous["close"] * 100) if previous and previous["close"] else None
    try:
        trading_timestamp = float(latest["time"]) if latest.get("time") else None
    except (TypeError, ValueError):
        trading_timestamp = None
    trading_date = datetime.fromtimestamp(trading_timestamp, VN_TZ).date().isoformat() if trading_timestamp else None

    return {
        "symbol": symbol,
        "value": latest["close"],
        "change": change,
        "change_percent": change_percent,
        "volume": latest.get("volume"),
        "trading_date": trading_date,
        "source": "Vietcap public chart API",
    }


def _fetch_index(symbol: str = "VNINDEX") -> dict | None:
    try:
        return _fetch_index_from_vci(symbol)
    except Exception as error:
        print(f"Failed to fetch {symbol} from Vietcap chart API: {error}")
        return None


def _market_totals_from_db() -> dict:
    db_path = Path(DATABASE_PATH)
    if not db_path.exists():
        return {"total_companies": 0, "total_market_cap": 0}

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            """
            SELECT
              COUNT(*) AS total_companies,
              COALESCE(SUM(market_cap), 0) AS total_market_cap
            FROM companies
            """
        ).fetchone()
    finally:
        conn.close()

    return {
        "total_companies": int(row["total_companies"] or 0),
        "total_market_cap": float(row["total_market_cap"] or 0),
    }


@router.get("/status")
def market_status():
    session = _market_session()
    vnindex = _fetch_index("VNINDEX")

    return {
        **session,
        "vn_index": vnindex.get("value") if vnindex else None,
        "vn_index_change": vnindex.get("change") if vnindex else None,
        "vn_index_change_percent": vnindex.get("change_percent") if vnindex else None,
        "vn_index_trading_date": vnindex.get("trading_date") if vnindex else None,
        "data_source": vnindex.get("source") if vnindex else None,
    }


@router.get("/overview")
def market_overview():
    session = _market_session()
    totals = _market_totals_from_db()
    vnindex = _fetch_index("VNINDEX")

    return {
        **session,
        "market_status": session["status"],
        "market_status_message": session["message"],
        "vn_index": vnindex.get("value") if vnindex else None,
        "vn_index_change": vnindex.get("change") if vnindex else None,
        "vn_index_change_percent": vnindex.get("change_percent") if vnindex else None,
        "vn_index_trading_date": vnindex.get("trading_date") if vnindex else None,
        "trading_volume": vnindex.get("volume") if vnindex else 0,
        "data_source": vnindex.get("source") if vnindex else None,
        **totals,
    }
