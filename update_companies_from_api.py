"""
Dong bo thong tin co ban cong ty vao bang companies dung vnstock 3.x (source KBS).

Nguon du lieu:
- listing.all_symbols()          : ten cong ty (1 request toan thi truong)
- listing.symbols_by_industries(): nganh       (1 request toan thi truong)
- company.overview() tung ticker : mo ta, charter_capital, shares_outstanding
- ticker_type.json               : company_type, industry (uu tien hon API)

Cap nhat cac cot:
- name, industry, company_type
- description, shares_outstanding, charter_capital
- profile_updated_at

Chay:
    python update_companies_from_api.py
    python update_companies_from_api.py --limit 10
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text

try:
    from vnstock import Vnstock
except ImportError:
    raise ImportError("Cai dat vnstock truoc: pip install vnstock")

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------
SCRIPT_DIR       = Path(__file__).resolve().parent
DB_PATH          = SCRIPT_DIR / "Database" / "master_db" / "analytics(final).db"
TICKER_TYPE_PATH = SCRIPT_DIR / "ticker_type.json"

REQUEST_DELAY = 3.5  # giay giua cac ticker - KBS gioi han 20 req/phut (3s/req)

DEFAULT_INDUSTRY_BY_TYPE: dict[str, str] = {
    "bank":       "Ngan hang",
    "securities": "Chung khoan",
    "insurance":  "Bao hiem",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_ticker(value: Any) -> str:
    return str(value or "").strip().upper()


def _to_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        n = float(str(value).replace(",", "").strip())
        return None if n != n else int(n)
    except Exception:
        return None


def _clean_text(value: Any) -> str | None:
    if not value:
        return None
    s = str(value).strip()
    return s if s else None


# ---------------------------------------------------------------------------
# Load ticker_type.json
# ---------------------------------------------------------------------------

def load_ticker_type_map() -> tuple[dict[str, str], dict[str, str]]:
    company_type_map: dict[str, str] = {}
    industry_map:     dict[str, str] = {}

    if not TICKER_TYPE_PATH.exists():
        print(f"[WARN] Khong tim thay {TICKER_TYPE_PATH}")
        return company_type_map, industry_map

    with open(TICKER_TYPE_PATH, "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    for ctype in ("bank", "securities", "insurance"):
        for ticker in payload.get(ctype, []):
            code = _normalize_ticker(ticker)
            if code:
                company_type_map[code] = ctype

    for ticker in payload.get("corporate", []):
        code = _normalize_ticker(ticker)
        if code and code not in company_type_map:
            company_type_map[code] = "corporate"

    raw_industry = payload.get("industry_map", {})
    if isinstance(raw_industry, dict):
        for ticker, ind in raw_industry.items():
            code = _normalize_ticker(ticker)
            if code and ind:
                industry_map[code] = str(ind).strip()

    for code, ctype in company_type_map.items():
        if code not in industry_map:
            default_ind = DEFAULT_INDUSTRY_BY_TYPE.get(ctype)
            if default_ind:
                industry_map[code] = default_ind

    print(
        f"[INFO] ticker_type.json: {len(company_type_map)} ma co loai "
        f"| {len(industry_map)} ma co nganh"
    )
    return company_type_map, industry_map


# ---------------------------------------------------------------------------
# Ensure DB columns
# ---------------------------------------------------------------------------

def ensure_company_columns(engine) -> None:
    required = {
        "company_type":       "TEXT NOT NULL DEFAULT 'corporate'",
        "description":        "TEXT",
        "market_cap":         "BIGINT",
        "shares_outstanding": "BIGINT",
        "charter_capital":    "BIGINT",
        "profile_updated_at": "TEXT",
    }
    with engine.begin() as conn:
        existing = {
            row[1]
            for row in conn.exec_driver_sql("PRAGMA table_info(companies)").fetchall()
        }
        for col_name, col_ddl in required.items():
            if col_name not in existing:
                conn.exec_driver_sql(
                    f"ALTER TABLE companies ADD COLUMN {col_name} {col_ddl}"
                )
                print(f"[DB] Them cot: {col_name}")


# ---------------------------------------------------------------------------
# Load toan bo ten + nganh — chi 2 request, khong tinh vao rate limit ticker
# ---------------------------------------------------------------------------

def load_market_data() -> dict[str, dict[str, str]]:
    """
    Goi 2 API toan thi truong:
      listing.all_symbols()           -> symbol, organ_name (ten cong ty)
      listing.symbols_by_industries() -> symbol, industry_name (nganh)

    Tra ve: { 'VHM': {'name': 'CTCP Vinhomes', 'industry': 'Bat dong san'}, ... }
    """
    data: dict[str, dict[str, str]] = {}

    try:
        listing = Vnstock().stock(symbol="VNM", source="KBS").listing

        # Ten cong ty
        df_names = listing.all_symbols()
        if df_names is not None and not df_names.empty:
            for _, row in df_names.iterrows():
                ticker = _normalize_ticker(row.get("symbol"))
                name   = _clean_text(row.get("organ_name"))
                if ticker:
                    data.setdefault(ticker, {})["name"] = name or ""
            print(f"[INFO] all_symbols: {len(df_names)} ma")

        # Nganh
        df_ind = listing.symbols_by_industries()
        if df_ind is not None and not df_ind.empty:
            for _, row in df_ind.iterrows():
                ticker   = _normalize_ticker(row.get("symbol"))
                industry = _clean_text(row.get("industry_name"))
                if ticker:
                    data.setdefault(ticker, {})["industry"] = industry or ""
            print(f"[INFO] symbols_by_industries: {len(df_ind)} ma co nganh")

    except Exception as err:
        print(f"[WARN] load_market_data: {err}")

    return data


# ---------------------------------------------------------------------------
# Fetch overview tung ticker — mo ta, charter_capital, shares_outstanding
# ---------------------------------------------------------------------------

def fetch_company_info(ticker: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    try:
        stock = Vnstock().stock(symbol=ticker, source="KBS")
        df    = stock.company.overview()
    except Exception as err:
        print(f"  [WARN] {ticker}: {err}")
        return result

    if df is None or df.empty:
        return result

    row = df.iloc[0].to_dict()

    result["description"]        = _clean_text(row.get("business_model") or row.get("history"))
    result["charter_capital"]    = _to_int(row.get("charter_capital"))
    result["shares_outstanding"] = _to_int(row.get("outstanding_shares"))

    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def update_companies(limit: int | None = None) -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Khong tim thay DB: {DB_PATH}")

    engine = create_engine(f"sqlite:///{DB_PATH}")
    ensure_company_columns(engine)

    company_type_map, industry_map = load_ticker_type_map()

    # Load ten + nganh toan thi truong (2 request, 1 lan)
    print("[INFO] Dang tai danh sach ten va nganh toan thi truong...")
    market_data = load_market_data()

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, ticker, name, industry, company_type,
                       description, market_cap, shares_outstanding, charter_capital
                FROM companies
                ORDER BY ticker
                """
            )
        ).mappings().all()

    if limit and limit > 0:
        rows = rows[:limit]

    print(f"[INFO] Tong so ma can cap nhat: {len(rows)}\n")

    updated = skipped = desc_ok = desc_miss = 0

    with engine.begin() as conn:
        for row in rows:
            ticker = _normalize_ticker(row.get("ticker"))
            if not ticker:
                skipped += 1
                continue

            # Lay overview tung ticker (co rate limit)
            info = fetch_company_info(ticker)
            time.sleep(REQUEST_DELAY)

            # --- Ten: market_data -> DB cu -> ticker ---
            name = (
                market_data.get(ticker, {}).get("name")
                or _clean_text(row.get("name"))
                or ticker
            )

            # --- Nganh: ticker_type.json -> market_data -> DB cu ---
            industry = (
                industry_map.get(ticker)
                or market_data.get(ticker, {}).get("industry")
                or _clean_text(row.get("industry"))
            )

            # --- Company type: ticker_type.json -> DB cu -> corporate ---
            company_type = (
                company_type_map.get(ticker)
                or _clean_text(row.get("company_type"))
                or "corporate"
            )
            if company_type not in ("corporate", "bank", "insurance", "securities"):
                company_type = "corporate"

            # --- Mo ta: API -> DB cu ---
            description = info.get("description") or _clean_text(row.get("description"))
            if info.get("description"):
                desc_ok += 1
            else:
                desc_miss += 1

            shares_outstanding = (
                _to_int(info.get("shares_outstanding"))
                or _to_int(row.get("shares_outstanding"))
            )
            charter_capital = (
                _to_int(info.get("charter_capital"))
                or _to_int(row.get("charter_capital"))
            )
            market_cap = _to_int(row.get("market_cap"))

            conn.execute(
                text(
                    """
                    UPDATE companies
                    SET name                = :name,
                        industry            = :industry,
                        company_type        = :company_type,
                        description         = :description,
                        market_cap          = :market_cap,
                        shares_outstanding  = :shares_outstanding,
                        charter_capital     = :charter_capital,
                        profile_updated_at  = :profile_updated_at
                    WHERE UPPER(ticker) = :ticker
                    """
                ),
                {
                    "name":               name,
                    "industry":           industry,
                    "company_type":       company_type,
                    "description":        description,
                    "market_cap":         market_cap,
                    "shares_outstanding": shares_outstanding,
                    "charter_capital":    charter_capital,
                    "profile_updated_at": datetime.now().isoformat(timespec="seconds"),
                    "ticker":             ticker,
                },
            )

            updated += 1
            has_desc = "co mo ta" if description else "khong mo ta"
            print(
                f"[OK] {ticker:6s} | {company_type:10s} | {(industry or '—'):24s} "
                f"| {(name or '—'):40s} | {has_desc}"
            )

    print(
        f"\n[SUMMARY] Cap nhat: {updated} | Bo qua: {skipped} | "
        f"Co mo ta: {desc_ok} | Khong mo ta: {desc_miss}"
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Cap nhat thong tin co ban cong ty (vnstock KBS)")
    parser.add_argument(
        "--limit", type=int, default=0,
        help="Chi cap nhat N ma dau (de test)"
    )
    args = parser.parse_args()

    print("=" * 80)
    print(f"[RUN] Bat dau: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    update_companies(limit=args.limit if args.limit > 0 else None)


if __name__ == "__main__":
    main()