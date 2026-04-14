# -*- coding: utf-8 -*-
"""
merge_tool.py
=============
Gop cac DB tu nhieu batch Kaggle vao 2 master DB.

Cau truc thu muc (dat script nay o FinancialApp/Database/):

  Database/
  ├── merge_tool.py          <- script nay
  ├── master_db/
  │   ├── master_raw.db      <- DB tong hop raw (tu cac raw.db)
  │   └── master_analytics.db <- DB tong hop analytics (tu cac analytics.db)
  ├── incoming_raw/          <- bo cac raw.db tu Kaggle vao day
  │   ├── raw_group01.db
  │   ├── raw_group02.db
  │   └── ...
  └── incoming_analytics/    <- bo cac analytics.db tu Kaggle vao day
      ├── analytics_group01.db
      ├── analytics_group02.db
      └── ...

Cach dung:
  python merge_tool.py            # gop tat ca
  python merge_tool.py --raw      # chi gop raw DB
  python merge_tool.py --analytics # chi gop analytics DB
  python merge_tool.py --preview  # xem tong ket khong gop

Luu y:
  - Upsert: neu da co (ticker, quarter, year, report_type, item_name)
    thi ghi de gia tri moi. Khong tao ban ghi trung.
  - Sau khi merge xong, co the xoa file trong incoming_*/ de gon.
"""

import argparse
import glob
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

MASTER_DIR          = _HERE / "master_db"
INCOMING_RAW_DIR    = _HERE / "incoming_raw"
INCOMING_ANA_DIR    = _HERE / "incoming_analytics"
MASTER_RAW_PATH     = MASTER_DIR / "master_raw.db"
MASTER_ANA_PATH     = MASTER_DIR / "master_analytics.db"

for _d in [MASTER_DIR, INCOMING_RAW_DIR, INCOMING_ANA_DIR]:
    _d.mkdir(parents=True, exist_ok=True)


# ==============================================================================
# SCHEMA MASTER RAW DB
# ==============================================================================

RAW_DDL = [
    """
    CREATE TABLE IF NOT EXISTS companies (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker       TEXT NOT NULL UNIQUE,
        name         TEXT NOT NULL,
        company_type TEXT NOT NULL DEFAULT 'corporate',
        industry     TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS report_periods (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id      INTEGER NOT NULL REFERENCES companies(id),
        quarter         INTEGER NOT NULL,
        year            INTEGER NOT NULL,
        report_kind     TEXT    DEFAULT 'consolidated',
        unit            TEXT    DEFAULT 'VND',
        unit_multiplier REAL    DEFAULT 1.0,
        is_ytd          INTEGER DEFAULT 0,
        pdf_filename    TEXT,
        ocr_chars       INTEGER,
        UNIQUE (company_id, quarter, year, report_kind)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS report_items (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        period_id   INTEGER NOT NULL REFERENCES report_periods(id),
        statement   TEXT    NOT NULL,
        item_order  INTEGER NOT NULL,
        item_code   TEXT,
        item_name   TEXT    NOT NULL,
        notes_ref   TEXT,
        value       INTEGER,
        slug        TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_ri_period   ON report_items (period_id)",
    "CREATE INDEX IF NOT EXISTS idx_ri_slug     ON report_items (slug)",
    "CREATE INDEX IF NOT EXISTS idx_rp_ticker   ON report_periods (company_id, year, quarter)",
]

# ==============================================================================
# SCHEMA MASTER ANALYTICS DB
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

# Wide tables duoc tao dong khi gap cot moi tu source


# ==============================================================================
# UPSERT HELPERS
# ==============================================================================

def _exec(conn, sql: str, params: dict | None = None) -> None:
    if params:
        conn.execute(text(sql), params)
    else:
        conn.execute(text(sql))


def _upsert_company_raw(conn, ticker: str, name: str, company_type: str) -> int:
    """Upsert company, tra ve company_id."""
    conn.execute(text("""
        INSERT INTO companies (ticker, name, company_type)
        VALUES (:t, :n, :ct)
        ON CONFLICT(ticker) DO UPDATE SET
            name         = COALESCE(excluded.name, companies.name),
            company_type = COALESCE(excluded.company_type, companies.company_type)
    """), {"t": ticker, "n": name or ticker, "ct": company_type or "corporate"})

    row = conn.execute(
        text("SELECT id FROM companies WHERE ticker = :t"), {"t": ticker}
    ).fetchone()
    return row[0]


def _upsert_company_ana(conn, ticker: str, name: str, company_type: str) -> None:
    conn.execute(text("""
        INSERT INTO companies (ticker, name, company_type)
        VALUES (:t, :n, :ct)
        ON CONFLICT(ticker) DO UPDATE SET
            name         = COALESCE(excluded.name, companies.name),
            company_type = COALESCE(excluded.company_type, companies.company_type)
    """), {"t": ticker, "n": name or ticker, "ct": company_type or "corporate"})


# ==============================================================================
# MERGE RAW DB
# ==============================================================================

def _ensure_raw_schema(engine) -> None:
    with engine.connect() as c:
        for ddl in RAW_DDL:
            c.execute(text(ddl))
        c.commit()


def merge_one_raw(engine_master, db_path: str) -> int:
    """Gop 1 raw.db vao master_raw.db. Tra ve so items da ghi."""
    engine_src = create_engine(f"sqlite:///{db_path}")
    insp       = inspect(engine_src)
    tables     = set(insp.get_table_names())

    if "report_items" not in tables:
        print(f"    [SKIP] Khong co bang report_items")
        return 0

    total = 0
    with engine_src.connect() as src, engine_master.connect() as dst:
        # Doc cac companies tu source
        companies = src.execute(text(
            "SELECT ticker, name, company_type FROM companies"
        )).fetchall()

        for (ticker, name, ctype) in companies:
            # Upsert company trong master
            master_cid = _upsert_company_raw(dst, ticker, name, ctype)

            # Doc periods cua ticker nay
            periods = src.execute(text("""
                SELECT rp.id, rp.quarter, rp.year, rp.report_kind,
                       rp.unit, rp.unit_multiplier, rp.is_ytd,
                       rp.pdf_filename, rp.ocr_chars
                FROM report_periods rp
                JOIN companies c ON c.id = rp.company_id
                WHERE c.ticker = :t
            """), {"t": ticker}).fetchall()

            for p in periods:
                src_period_id = p[0]

                # Upsert period trong master
                dst.execute(text("""
                    INSERT INTO report_periods
                        (company_id, quarter, year, report_kind, unit,
                         unit_multiplier, is_ytd, pdf_filename, ocr_chars)
                    VALUES (:cid, :q, :y, :rk, :u, :um, :iy, :pf, :oc)
                    ON CONFLICT(company_id, quarter, year, report_kind) DO UPDATE SET
                        unit            = excluded.unit,
                        unit_multiplier = excluded.unit_multiplier,
                        is_ytd          = excluded.is_ytd,
                        pdf_filename    = COALESCE(excluded.pdf_filename, report_periods.pdf_filename),
                        ocr_chars       = COALESCE(excluded.ocr_chars, report_periods.ocr_chars)
                """), {
                    "cid": master_cid,
                    "q": p[1], "y": p[2], "rk": p[3],
                    "u": p[4], "um": p[5], "iy": p[6],
                    "pf": p[7], "oc": p[8],
                })

                master_pid = dst.execute(text("""
                    SELECT id FROM report_periods
                    WHERE company_id = :cid AND quarter = :q AND year = :y
                      AND report_kind = :rk
                """), {"cid": master_cid, "q": p[1], "y": p[2], "rk": p[3]}).fetchone()[0]

                # Xoa items cu cua period nay trong master (de ghi lai sach)
                dst.execute(text(
                    "DELETE FROM report_items WHERE period_id = :pid"
                ), {"pid": master_pid})

                # Copy items
                items = src.execute(text("""
                    SELECT statement, item_order, item_code, item_name,
                           notes_ref, value, slug
                    FROM report_items WHERE period_id = :pid
                """), {"pid": src_period_id}).fetchall()

                for item in items:
                    dst.execute(text("""
                        INSERT INTO report_items
                            (period_id, statement, item_order, item_code,
                             item_name, notes_ref, value, slug)
                        VALUES (:pid, :st, :io, :ic, :in_, :nr, :val, :sl)
                    """), {
                        "pid": master_pid,
                        "st":  item[0], "io": item[1], "ic": item[2],
                        "in_": item[3], "nr": item[4], "val": item[5],
                        "sl":  item[6],
                    })
                    total += 1

        dst.commit()

    return total


# ==============================================================================
# MERGE ANALYTICS DB
# ==============================================================================

def _get_analytics_tables(engine) -> list[str]:
    """Lay danh sach wide table (financials_*)."""
    insp = inspect(engine)
    return [t for t in insp.get_table_names() if t.startswith("financials_")]


def _ensure_wide_table(engine_master, table_name: str, cols: list[str]) -> None:
    """Tao wide table neu chua co, them cot moi neu can."""
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

    # Them cot moi neu source co them
    existing_cols = {col["name"] for col in insp.get_columns(table_name)}
    new_cols = [c for c in cols if c not in existing_cols]
    if new_cols:
        with engine_master.connect() as c:
            for nc in new_cols:
                c.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{nc}" INTEGER DEFAULT NULL'))
            c.commit()


def merge_one_analytics(engine_master, db_path: str) -> int:
    """Gop 1 analytics.db vao master_analytics.db."""
    engine_src = create_engine(f"sqlite:///{db_path}")
    insp_src   = inspect(engine_src)
    tables     = set(insp_src.get_table_names())

    wide_tables = [t for t in tables if t.startswith("financials_")]
    if not wide_tables:
        print(f"    [SKIP] Khong co bang financials_*")
        return 0

    total = 0

    with engine_src.connect() as src, engine_master.connect() as dst:
        # Upsert companies
        if "companies" in tables:
            companies = src.execute(text(
                "SELECT ticker, name, company_type FROM companies"
            )).fetchall()
            for (ticker, name, ctype) in companies:
                _upsert_company_ana(dst, ticker, name, ctype)

        # Gop tung wide table
        for table in wide_tables:
            cols = [c["name"] for c in insp_src.get_columns(table)]
            data_cols = [c for c in cols if c not in ("id", "ticker", "quarter", "year")]

            # Dam bao table + cot ton tai trong master
            _ensure_wide_table(engine_master, table, data_cols)

            rows = src.execute(text(f'SELECT * FROM "{table}"')).fetchall()
            col_names = [c["name"] for c in insp_src.get_columns(table)]

            for row in rows:
                d = dict(zip(col_names, row))
                ticker  = d.get("ticker")
                quarter = d.get("quarter")
                year    = d.get("year")
                if not ticker or not quarter or not year:
                    continue

                # Xoa row cu
                dst.execute(text(
                    f'DELETE FROM "{table}" WHERE ticker=:t AND quarter=:q AND year=:y'
                ), {"t": ticker, "q": quarter, "y": year})

                # Insert moi
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


# ==============================================================================
# MAIN
# ==============================================================================

def merge_raw() -> None:
    print(f"\n{'='*60}")
    print("MERGE RAW DB")
    print(f"  incoming: {INCOMING_RAW_DIR}")
    print(f"  master  : {MASTER_RAW_PATH}")
    print(f"{'='*60}")

    db_files = sorted(glob.glob(str(INCOMING_RAW_DIR / "*.db")))
    if not db_files:
        print(f"  [EMPTY] Khong co file .db nao trong {INCOMING_RAW_DIR}")
        return

    engine_master = create_engine(f"sqlite:///{MASTER_RAW_PATH}")
    _ensure_raw_schema(engine_master)

    grand_total = 0
    for db_file in db_files:
        fname = os.path.basename(db_file)
        print(f"\n  -- {fname}")
        try:
            n = merge_one_raw(engine_master, db_file)
            print(f"     -> {n:,} items da ghi")
            grand_total += n
        except Exception as e:
            print(f"     [ERROR] {e}")
            traceback.print_exc()

    print(f"\n  TONG: {grand_total:,} items vao {MASTER_RAW_PATH}")
    _preview_raw(engine_master)


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


def _preview_raw(engine) -> None:
    print("\n  PREVIEW master_raw.db:")
    with engine.connect() as c:
        n = c.execute(text("SELECT COUNT(*) FROM report_items")).scalar()
        print(f"    report_items : {n:,} rows")
        n = c.execute(text("SELECT COUNT(DISTINCT id) FROM report_periods")).scalar()
        print(f"    report_periods: {n:,} ky")
        for r in c.execute(text(
            "SELECT c.ticker, COUNT(ri.id) "
            "FROM report_items ri "
            "JOIN report_periods rp ON ri.period_id = rp.id "
            "JOIN companies c ON c.id = rp.company_id "
            "GROUP BY c.ticker ORDER BY c.ticker"
        )).fetchall():
            print(f"    {r[0]:10s}: {r[1]:,} items")


def _preview_analytics(engine) -> None:
    print("\n  PREVIEW master_analytics.db:")
    insp = inspect(engine)
    for table in sorted(insp.get_table_names()):
        with engine.connect() as c:
            n = c.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar()
            print(f"    {table}: {n:,} rows")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge BCTC DB tu nhieu batch Kaggle")
    parser.add_argument("--raw",       action="store_true", help="Chi merge raw.db")
    parser.add_argument("--analytics", action="store_true", help="Chi merge analytics.db")
    parser.add_argument("--preview",   action="store_true", help="Chi xem tong ket, khong gop")
    args = parser.parse_args()

    if args.preview:
        if MASTER_RAW_PATH.exists():
            _preview_raw(create_engine(f"sqlite:///{MASTER_RAW_PATH}"))
        if MASTER_ANA_PATH.exists():
            _preview_analytics(create_engine(f"sqlite:///{MASTER_ANA_PATH}"))
    elif args.raw:
        merge_raw()
    elif args.analytics:
        merge_analytics()
    else:
        merge_raw()
        merge_analytics()

    print("\nDONE.")