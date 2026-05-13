"""
Fetch company officers from Vnstock and save them to analytics(final).db.

Usage:
    python update_company_officers_from_vnstock.py --limit 10
    python update_company_officers_from_vnstock.py --tickers VCB,FPT,HPG
    python update_company_officers_from_vnstock.py --source VCI --fallback-source KBS

The script creates/updates table `company_officers` and replaces rows per
ticker after a successful fetch.
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, text

from backend.config import DATABASE_PATH

try:
    from vnstock import Vnstock
except ImportError as exc:
    raise SystemExit("Install vnstock first: pip install vnstock") from exc


DEFAULT_DELAY_SECONDS = 3.5
SOURCE_CHOICES = ("KBS", "VCI")


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    value = str(value).strip()
    return value or None


def to_int(value: Any) -> int | None:
    try:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return None
        return int(float(str(value).replace(",", "").strip()))
    except (TypeError, ValueError):
        return None


def to_float(value: Any) -> float | None:
    try:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return None
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def pick(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in row and row[key] is not None:
            return row[key]
    return None


def normalize_ticker(value: Any) -> str:
    return str(value or "").strip().upper()


def normalize_row(ticker: str, source: str, row: dict[str, Any], index: int) -> dict[str, Any] | None:
    name = clean_text(pick(row, "name", "officer_name", "officerName"))
    if not name:
        return None

    return {
        "ticker": ticker,
        "name": name,
        "position": clean_text(pick(row, "officer_position", "officerPosition", "position")),
        "position_en": clean_text(pick(row, "position_en", "positionEn")),
        "from_date": to_int(pick(row, "from_date", "fromDate")),
        "owner_code": clean_text(pick(row, "owner_code", "ownerCode")),
        "officer_own_percent": to_float(
            pick(row, "officer_own_percent", "officerOwnPercent", "ownership_percentage")
        ),
        "quantity": to_int(pick(row, "quantity", "shares_owned", "sharesOwned")),
        "update_date": clean_text(pick(row, "update_date", "updateDate")),
        "source": source,
        "display_order": index,
        "raw_json": json.dumps(row, ensure_ascii=False, default=str),
        "fetched_at": datetime.now().isoformat(timespec="seconds"),
    }


def ensure_officers_table(engine) -> None:
    with engine.begin() as conn:
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS company_officers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                name TEXT NOT NULL,
                position TEXT,
                position_en TEXT,
                from_date INTEGER,
                owner_code TEXT,
                officer_own_percent REAL,
                quantity BIGINT,
                update_date TEXT,
                source TEXT NOT NULL DEFAULT 'KBS',
                display_order INTEGER,
                raw_json TEXT,
                fetched_at TEXT
            )
            """
        )

        required_columns = {
            "position_en": "TEXT",
            "from_date": "INTEGER",
            "owner_code": "TEXT",
            "officer_own_percent": "REAL",
            "quantity": "BIGINT",
            "update_date": "TEXT",
            "source": "TEXT NOT NULL DEFAULT 'KBS'",
            "display_order": "INTEGER",
            "raw_json": "TEXT",
            "fetched_at": "TEXT",
        }
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(company_officers)").fetchall()}
        for column, ddl in required_columns.items():
            if column not in existing:
                conn.exec_driver_sql(f"ALTER TABLE company_officers ADD COLUMN {column} {ddl}")

        conn.exec_driver_sql(
            """
            CREATE INDEX IF NOT EXISTS idx_company_officers_ticker
            ON company_officers(ticker)
            """
        )


def load_tickers(engine, tickers_arg: str | None, limit: int | None) -> list[str]:
    if tickers_arg:
        tickers = [normalize_ticker(item) for item in tickers_arg.split(",")]
        return [ticker for ticker in tickers if ticker]

    with engine.connect() as conn:
        rows = conn.execute(text("SELECT ticker FROM companies ORDER BY ticker")).fetchall()

    tickers = [normalize_ticker(row[0]) for row in rows if row[0]]
    if limit and limit > 0:
        return tickers[:limit]
    return tickers


def fetch_officers(ticker: str, source: str) -> list[dict[str, Any]]:
    stock = Vnstock().stock(symbol=ticker, source=source)
    df = stock.company.officers()
    if df is None or df.empty:
        return []

    rows: list[dict[str, Any]] = []
    for index, (_, raw_row) in enumerate(df.iterrows()):
        normalized = normalize_row(ticker, source, raw_row.to_dict(), index)
        if normalized:
            rows.append(normalized)
    return rows


def save_officers(engine, ticker: str, officers: list[dict[str, Any]]) -> None:
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM company_officers WHERE UPPER(ticker) = :ticker"), {"ticker": ticker})
        if not officers:
            return

        conn.execute(
            text(
                """
                INSERT INTO company_officers (
                    ticker,
                    name,
                    position,
                    position_en,
                    from_date,
                    owner_code,
                    officer_own_percent,
                    quantity,
                    update_date,
                    source,
                    display_order,
                    raw_json,
                    fetched_at
                )
                VALUES (
                    :ticker,
                    :name,
                    :position,
                    :position_en,
                    :from_date,
                    :owner_code,
                    :officer_own_percent,
                    :quantity,
                    :update_date,
                    :source,
                    :display_order,
                    :raw_json,
                    :fetched_at
                )
                """
            ),
            officers,
        )


def update_company_officers(
    tickers_arg: str | None = None,
    limit: int | None = None,
    source: str = "KBS",
    fallback_source: str | None = "VCI",
    delay_seconds: float = DEFAULT_DELAY_SECONDS,
) -> None:
    if not DATABASE_PATH.exists():
        raise FileNotFoundError(f"Database not found: {DATABASE_PATH}")

    source = source.upper()
    fallback_source = fallback_source.upper() if fallback_source else None
    if source not in SOURCE_CHOICES:
        raise ValueError(f"Unsupported source: {source}")
    if fallback_source and fallback_source not in SOURCE_CHOICES:
        raise ValueError(f"Unsupported fallback source: {fallback_source}")

    engine = create_engine(f"sqlite:///{DATABASE_PATH}")
    ensure_officers_table(engine)
    tickers = load_tickers(engine, tickers_arg, limit)

    print(f"[INFO] Updating officers for {len(tickers)} tickers")
    print(f"[INFO] Source={source} | fallback={fallback_source or 'none'} | DB={DATABASE_PATH}")

    updated = failed = empty = 0
    for index, ticker in enumerate(tickers, start=1):
        active_source = source
        try:
            officers = fetch_officers(ticker, active_source)
            if not officers and fallback_source and fallback_source != source:
                active_source = fallback_source
                officers = fetch_officers(ticker, active_source)

            save_officers(engine, ticker, officers)
            if officers:
                updated += 1
                print(f"[OK] {index:4d}/{len(tickers)} {ticker}: {len(officers)} officers ({active_source})")
            else:
                empty += 1
                print(f"[EMPTY] {index:4d}/{len(tickers)} {ticker}: no officers")
        except Exception as exc:
            failed += 1
            print(f"[FAIL] {index:4d}/{len(tickers)} {ticker}: {exc}")

        if delay_seconds > 0 and index < len(tickers):
            time.sleep(delay_seconds)

    print(f"[SUMMARY] updated={updated} | empty={empty} | failed={failed}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Update company officers from vnstock")
    parser.add_argument("--tickers", help="Comma-separated ticker list, e.g. VCB,FPT,HPG")
    parser.add_argument("--limit", type=int, default=0, help="Only process first N DB tickers")
    parser.add_argument("--source", choices=SOURCE_CHOICES, default="KBS")
    parser.add_argument("--fallback-source", choices=SOURCE_CHOICES, default="VCI")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_SECONDS, help="Delay between tickers")
    args = parser.parse_args()

    update_company_officers(
        tickers_arg=args.tickers,
        limit=args.limit if args.limit > 0 else None,
        source=args.source,
        fallback_source=args.fallback_source,
        delay_seconds=args.delay,
    )


if __name__ == "__main__":
    main()
