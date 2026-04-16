# -*- coding: utf-8 -*-

import argparse
import glob
import json
import os
import traceback
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

# ==============================================================================
# DUONG DAN
# ==============================================================================

try:
    _HERE = Path(os.path.dirname(os.path.abspath(__file__)))
except NameError:
    _HERE = Path(os.path.abspath(os.getcwd()))

MASTER_DIR       = _HERE / "master_db"
INCOMING_RAW_DIR = _HERE / "incoming_raw"
INCOMING_ANA_DIR = _HERE / "incoming_analytics"
MASTER_JSON_PATH = MASTER_DIR / "master_raw.json"
MASTER_ANA_PATH  = MASTER_DIR / "master_analytics.db"

for _d in [MASTER_DIR, INCOMING_RAW_DIR, INCOMING_ANA_DIR]:
    _d.mkdir(parents=True, exist_ok=True)


# ==============================================================================
# MERGE RAW JSON
# ==============================================================================

def _load_json(path) -> dict:
    if not Path(path).exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(path, data: dict):
    tmp = str(path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def merge_raw_json() -> None:
    print(f"\n{'='*60}")
    print("MERGE RAW JSON")
    print(f"  incoming: {INCOMING_RAW_DIR}")
    print(f"  master  : {MASTER_JSON_PATH}")
    print(f"{'='*60}")

    json_files = sorted(
        glob.glob(str(INCOMING_RAW_DIR / "*.json"))
    )
    if not json_files:
        print(f"  [EMPTY] Khong co file .json nao trong {INCOMING_RAW_DIR}")
        return

    # Load master hien tai
    master = _load_json(MASTER_JSON_PATH)
    total_added = total_updated = 0

    for jf in json_files:
        fname = os.path.basename(jf)
        print(f"\n  -- {fname}")
        try:
            incoming = _load_json(jf)
            for ticker, periods in incoming.items():
                if ticker not in master:
                    master[ticker] = []

                existing_keys = {
                    (p["quarter"], p["year"])
                    for p in master[ticker]
                }

                for period in periods:
                    key = (period["quarter"], period["year"])
                    if key in existing_keys:
                        # Ghi de period cu
                        master[ticker] = [
                            p for p in master[ticker]
                            if not (p["quarter"] == key[0] and p["year"] == key[1])
                        ]
                        total_updated += 1
                    else:
                        total_added += 1
                    master[ticker].append(period)

                # Sort theo nam/quy
                master[ticker].sort(key=lambda p: (p["year"], p["quarter"]))

            print(f"     -> OK ({len(incoming)} tickers)")
        except Exception as e:
            print(f"     [ERROR] {e}")
            traceback.print_exc()

    _save_json(MASTER_JSON_PATH, master)

    print(f"\n  TONG: +{total_added} ky moi | ~{total_updated} ky cap nhat")
    print(f"  Luu tai: {MASTER_JSON_PATH}")
    _preview_json(master)


def _preview_json(data: dict):
    print("\n  PREVIEW master_raw.json:")
    total_periods = sum(len(v) for v in data.values())
    total_items   = sum(
        sum(len(s) for s in p["items"].values())
        for periods in data.values()
        for p in periods
    )
    print(f"    Tickers : {len(data)}")
    print(f"    Ky BC   : {total_periods}")
    print(f"    Items   : {total_items:,}")
    for ticker in sorted(data.keys()):
        n_periods = len(data[ticker])
        n_items   = sum(len(s) for p in data[ticker] for s in p["items"].values())
        print(f"    {ticker:10s}: {n_periods} ky | {n_items:,} items")


# ==============================================================================
# MERGE ANALYTICS DB (giu nguyen logic cu)
# ==============================================================================

ANA_DDL = [
    """
    CREATE TABLE IF NOT EXISTS companies (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker       TEXT NOT NULL UNIQUE,
        name         TEXT NOT NULL,
        company_type TEXT NOT NULL DEFAULT 'corporate',
        industry     TEXT
    )
    """,
]


def _upsert_company_ana(conn, ticker, name, ctype):
    conn.execute(text("""
        INSERT INTO companies (ticker, name, company_type)
        VALUES (:t, :n, :ct)
        ON CONFLICT(ticker) DO UPDATE SET
            name         = COALESCE(excluded.name, companies.name),
            company_type = COALESCE(excluded.company_type, companies.company_type)
    """), {"t": ticker, "n": name or ticker, "ct": ctype or "corporate"})


def _ensure_wide_table(engine_master, table_name, cols):
    insp = inspect(engine_master)
    existing_tables = set(insp.get_table_names())
    if table_name not in existing_tables:
        col_defs = ",\n".join(f'    "{c}" INTEGER DEFAULT NULL' for c in cols)
        ddl = f"""
        CREATE TABLE IF NOT EXISTS "{table_name}" (
            id      INTEGER PRIMARY KEY,
            ticker  TEXT    NOT NULL,
            quarter INTEGER NOT NULL,
            year    INTEGER NOT NULL,
            {col_defs},
            UNIQUE (ticker, quarter, year)
        )
        """
        with engine_master.connect() as c:
            c.execute(text(ddl))
            c.commit()
        return
    existing_cols = {col["name"] for col in insp.get_columns(table_name)}
    new_cols = [c for c in cols if c not in existing_cols]
    if new_cols:
        with engine_master.connect() as c:
            for nc in new_cols:
                c.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{nc}" INTEGER DEFAULT NULL'))
            c.commit()


def merge_one_analytics(engine_master, db_path) -> int:
    engine_src = create_engine(f"sqlite:///{db_path}")
    insp_src   = inspect(engine_src)
    tables     = set(insp_src.get_table_names())
    wide_tables = [t for t in tables if t.startswith("financials_")]
    if not wide_tables:
        print(f"    [SKIP] Khong co bang financials_*")
        return 0

    for table in wide_tables:
        cols = [c["name"] for c in insp_src.get_columns(table)]
        data_cols = [c for c in cols if c not in ("id", "ticker", "quarter", "year")]
        _ensure_wide_table(engine_master, table, data_cols)

    total = 0
    with engine_src.connect() as src, engine_master.connect() as dst:
        if "companies" in tables:
            for (ticker, name, ctype) in src.execute(text(
                "SELECT ticker, name, company_type FROM companies"
            )).fetchall():
                _upsert_company_ana(dst, ticker, name, ctype)

        for table in wide_tables:
            cols      = [c["name"] for c in insp_src.get_columns(table)]
            col_names = cols
            data_cols = [c for c in cols if c not in ("id", "ticker", "quarter", "year")]
            rows      = src.execute(text(f'SELECT * FROM "{table}"')).fetchall()

            for row in rows:
                d       = dict(zip(col_names, row))
                ticker  = d.get("ticker")
                quarter = d.get("quarter")
                year    = d.get("year")
                if not ticker or not quarter or not year:
                    continue
                dst.execute(text(
                    f'DELETE FROM "{table}" WHERE ticker=:t AND quarter=:q AND year=:y'
                ), {"t": ticker, "q": quarter, "y": year})

                insert_cols  = ["ticker", "quarter", "year"] + data_cols
                placeholders = ", ".join(f":{c}" for c in insert_cols)
                col_list     = ", ".join(f'"{c}"' for c in insert_cols)
                params = {"ticker": ticker, "quarter": quarter, "year": year}
                for dc in data_cols:
                    params[dc] = d.get(dc)
                dst.execute(text(
                    f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders})'
                ), params)
                total += 1

        dst.commit()
    return total


def merge_analytics() -> None:
    print(f"\n{'='*60}")
    print("MERGE ANALYTICS DB")
    print(f"  incoming: {INCOMING_ANA_DIR}")
    print(f"  master  : {MASTER_ANA_PATH}")
    print(f"{'='*60}")

    db_files = sorted(glob.glob(str(INCOMING_ANA_DIR / "*.db")))
    if not db_files:
        print(f"  [EMPTY] Khong co file .db nao trong {INCOMING_ANA_DIR}")
        return

    engine_master = create_engine(f"sqlite:///{MASTER_ANA_PATH}")
    with engine_master.connect() as c:
        for ddl in ANA_DDL:
            c.execute(text(ddl))
        c.commit()

    grand_total = 0
    for db_file in db_files:
        fname = os.path.basename(db_file)
        print(f"\n  -- {fname}")
        try:
            n = merge_one_analytics(engine_master, db_file)
            print(f"     -> {n:,} rows da ghi")
            grand_total += n
        except Exception as e:
            print(f"     [ERROR] {e}")
            traceback.print_exc()

    print(f"\n  TONG: {grand_total:,} rows vao {MASTER_ANA_PATH}")
    _preview_analytics(engine_master)


def _preview_analytics(engine):
    print("\n  PREVIEW master_analytics.db:")
    insp = inspect(engine)
    for table in sorted(insp.get_table_names()):
        with engine.connect() as c:
            n = c.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar()
            print(f"    {table}: {n:,} rows")


# ==============================================================================
# MAIN
# ==============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge BCTC DB/JSON tu nhieu batch Kaggle")
    parser.add_argument("--raw",       action="store_true", help="Chi merge raw JSON")
    parser.add_argument("--analytics", action="store_true", help="Chi merge analytics DB")
    parser.add_argument("--preview",   action="store_true", help="Xem tong ket, khong gop")
    args = parser.parse_args()

    if args.preview:
        if MASTER_JSON_PATH.exists():
            _preview_json(_load_json(MASTER_JSON_PATH))
        if MASTER_ANA_PATH.exists():
            _preview_analytics(create_engine(f"sqlite:///{MASTER_ANA_PATH}"))
    elif args.raw:
        merge_raw_json()
    elif args.analytics:
        merge_analytics()
    else:
        merge_raw_json()
        merge_analytics()

    print("\nDONE.")