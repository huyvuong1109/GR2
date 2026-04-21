"""
Dong bo thong tin cong ty vao bang companies tu API chung khoan.

Nguon du lieu:
- Gia realtime: SSI iBoard API
- Ho so cong ty: VNDirect finfo API

Cap nhat cac cot:
- name
- industry
- company_type (map tu ticker_type.json)
- current_price
- market_cap
- shares_outstanding
- profile_updated_at

Chay mot lan:
    python update_companies_from_api.py

Chay dinh ky moi 60 phut:
    python update_companies_from_api.py --interval-minutes 60
"""

from __future__ import annotations

import argparse
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from sqlalchemy import create_engine, text

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR / "Database" / "master_db" / "analytics(final).db"
TICKER_TYPE_PATH = SCRIPT_DIR / "ticker_type.json"

SSI_API_URL = "https://iboard.ssi.com.vn/dchart/api/1.1/defaultAllStocks"
VNDIRECT_STOCK_API = "https://finfo-api.vndirect.com.vn/v4/stocks"

REQUEST_TIMEOUT = 15


def _normalize_ticker(value: Any) -> str:
    return str(value or "").strip().upper()


def _to_number(value: Any) -> float | None:
    try:
        if value is None:
            return None
        if isinstance(value, str):
            value = value.replace(",", "").strip()
            if not value:
                return None
        number = float(value)
        if number != number:
            return None
        return number
    except Exception:
        return None


def _normalize_price_vnd(raw_value: Any) -> float | None:
    number = _to_number(raw_value)
    if number is None or number <= 0:
        return None

    # Nhieu API tra gia theo nghin VND; trong DB can VND.
    if number < 1000:
        return number * 1000
    return number


def load_ticker_type_map() -> dict[str, str]:
    mapping: dict[str, str] = {}
    if not TICKER_TYPE_PATH.exists():
        return mapping

    import json

    with open(TICKER_TYPE_PATH, "r", encoding="utf-8") as file:
        payload = json.load(file)

    for company_type in ("bank", "securities", "insurance"):
        tickers = payload.get(company_type, [])
        if not isinstance(tickers, list):
            continue
        for ticker in tickers:
            code = _normalize_ticker(ticker)
            if code:
                mapping[code] = company_type

    corporate_list = payload.get("corporate", [])
    if isinstance(corporate_list, list):
        for ticker in corporate_list:
            code = _normalize_ticker(ticker)
            if code and code not in mapping:
                mapping[code] = "corporate"

    return mapping


def ensure_company_columns(engine) -> None:
    required_columns = {
        "company_type": "TEXT NOT NULL DEFAULT 'corporate'",
        "current_price": "REAL",
        "market_cap": "BIGINT",
        "shares_outstanding": "BIGINT",
        "profile_updated_at": "TEXT",
    }

    with engine.begin() as conn:
        existing = {
            row[1] for row in conn.exec_driver_sql("PRAGMA table_info(companies)").fetchall()
        }

        for column_name, column_ddl in required_columns.items():
            if column_name in existing:
                continue
            conn.exec_driver_sql(
                f"ALTER TABLE companies ADD COLUMN {column_name} {column_ddl}"
            )


def fetch_prices_from_ssi() -> dict[str, float]:
    prices: dict[str, float] = {}

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
    }

    try:
        response = requests.get(SSI_API_URL, headers=headers, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        payload = response.json()
    except Exception as error:
        print(f"[WARN] Khong lay duoc gia tu SSI: {error}")
        return prices

    if isinstance(payload, dict):
        iterable = payload.items()
    elif isinstance(payload, list):
        iterable = [(_normalize_ticker(item.get("symbol") or item.get("ticker")), item) for item in payload if isinstance(item, dict)]
    else:
        iterable = []

    for key, info in iterable:
        ticker = _normalize_ticker(key)
        if not ticker or not isinstance(info, dict):
            continue

        raw_price = (
            info.get("lastPrice")
            or info.get("matchPrice")
            or info.get("closePrice")
            or info.get("price")
        )
        normalized = _normalize_price_vnd(raw_price)
        if normalized is not None:
            prices[ticker] = normalized

    print(f"[INFO] SSI gia: {len(prices)} ma")
    return prices


def fetch_profile_from_vndirect(ticker: str) -> dict[str, Any]:
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
    }

    params = {
        "q": f"code:{ticker}",
        "fields": "code,companyName,name,industryName,icbName,marketCap,marketCapitalization,sharesOutstanding,listedShare,listedShares",
        "size": 1,
    }

    try:
        response = requests.get(VNDIRECT_STOCK_API, params=params, headers=headers, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return {}

    rows = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not rows:
        return {}

    row = rows[0] if isinstance(rows[0], dict) else {}

    return {
        "name": row.get("companyName") or row.get("name"),
        "industry": row.get("industryName") or row.get("icbName"),
        "market_cap": row.get("marketCap") or row.get("marketCapitalization"),
        "shares_outstanding": row.get("sharesOutstanding") or row.get("listedShare") or row.get("listedShares"),
    }


def update_companies(limit: int | None = None) -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Khong tim thay database: {DB_PATH}")

    engine = create_engine(f"sqlite:///{DB_PATH}")
    ensure_company_columns(engine)

    ticker_type_map = load_ticker_type_map()
    prices = fetch_prices_from_ssi()

    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, ticker, name, industry, company_type,
                       current_price, market_cap, shares_outstanding
                FROM companies
                ORDER BY ticker
                """
            )
        ).mappings().all()

    if limit is not None and limit > 0:
        rows = rows[:limit]

    updated = 0
    skipped = 0

    with engine.begin() as conn:
        for row in rows:
            ticker = _normalize_ticker(row.get("ticker"))
            if not ticker:
                skipped += 1
                continue

            profile = fetch_profile_from_vndirect(ticker)
            current_price = prices.get(ticker)
            if current_price is None:
                current_price = _to_number(row.get("current_price"))

            market_cap = _to_number(profile.get("market_cap")) or _to_number(row.get("market_cap"))
            shares_outstanding = _to_number(profile.get("shares_outstanding")) or _to_number(row.get("shares_outstanding"))

            if market_cap is None and current_price and shares_outstanding:
                market_cap = current_price * shares_outstanding
            if shares_outstanding is None and market_cap and current_price:
                shares_outstanding = round(market_cap / current_price)

            company_type = ticker_type_map.get(ticker) or row.get("company_type") or "corporate"
            if company_type not in ("corporate", "bank", "insurance", "securities"):
                company_type = "corporate"

            name = profile.get("name") or row.get("name") or ticker
            industry = profile.get("industry") or row.get("industry")

            conn.execute(
                text(
                    """
                    UPDATE companies
                    SET name = :name,
                        industry = :industry,
                        company_type = :company_type,
                        current_price = :current_price,
                        market_cap = :market_cap,
                        shares_outstanding = :shares_outstanding,
                        profile_updated_at = :profile_updated_at
                    WHERE UPPER(ticker) = :ticker
                    """
                ),
                {
                    "name": name,
                    "industry": industry,
                    "company_type": company_type,
                    "current_price": current_price,
                    "market_cap": int(market_cap) if market_cap is not None else None,
                    "shares_outstanding": int(shares_outstanding) if shares_outstanding is not None else None,
                    "profile_updated_at": datetime.now().isoformat(timespec="seconds"),
                    "ticker": ticker,
                },
            )
            updated += 1
            print(f"[OK] {ticker}: type={company_type}, price={current_price or 0:,.0f}")
            time.sleep(0.12)

    print(f"\n[SUMMARY] Da cap nhat {updated} ma | bo qua {skipped} ma")


def run_loop(interval_minutes: int, limit: int | None = None) -> None:
    while True:
        start = datetime.now()
        print("=" * 72)
        print(f"[RUN] Bat dau dong bo companies: {start.strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 72)

        try:
            update_companies(limit=limit)
        except Exception as error:
            print(f"[ERROR] {error}")

        if interval_minutes <= 0:
            break

        print(f"\n[WAIT] Ngu {interval_minutes} phut truoc lan cap nhat tiep theo...")
        time.sleep(interval_minutes * 60)


def main() -> None:
    parser = argparse.ArgumentParser(description="Dong bo thong tin companies tu API chung khoan")
    parser.add_argument("--interval-minutes", type=int, default=0, help="Chu ky cap nhat (phut). 0 = chay mot lan")
    parser.add_argument("--limit", type=int, default=0, help="Chi cap nhat N ma dau tien (phuc vu test)")
    args = parser.parse_args()

    limit = args.limit if args.limit and args.limit > 0 else None
    run_loop(interval_minutes=args.interval_minutes, limit=limit)


if __name__ == "__main__":
    main()
