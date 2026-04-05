"""
merge_tool.py - v6: Schema financial_data (ticker, quarter, year, report_type, item_name, value)
Hỗ trợ merge:
  - DB mới từ pipeline V3 (bảng financial_data)
  - DB cũ long-format V2 (bảng financial_items)
  - DB cũ wide-format V1 (income_statements / balance_sheets / cash_flows)
  - financial_system.db (bảng financial_data — copy thẳng)
"""
import os
import glob
import traceback
from sqlalchemy import create_engine, inspect, text

# --- CẤU HÌNH ---
try:
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
except NameError:
    SCRIPT_DIR = os.path.abspath(os.getcwd())

SOURCE_FOLDER    = os.path.join(SCRIPT_DIR, "new_db_from_kaggle")
MASTER_DB_FOLDER = os.path.join(SCRIPT_DIR, "master_db")
MASTER_DB_PATH   = os.path.join(MASTER_DB_FOLDER, "master.db")

os.makedirs(MASTER_DB_FOLDER, exist_ok=True)
os.makedirs(SOURCE_FOLDER,    exist_ok=True)

print(f"📁 SCRIPT_DIR    : {SCRIPT_DIR}")
print(f"📁 SOURCE_FOLDER : {SOURCE_FOLDER}")
print(f"📁 MASTER_DB_PATH: {MASTER_DB_PATH}")
_found = glob.glob(os.path.join(SOURCE_FOLDER, "*.db"))
print(f"🔍 DB files: {_found}\n")


# ==============================================================================
# MASTER SCHEMA — khớp 100% financial_system.db
# ==============================================================================
MASTER_DDL = """
CREATE TABLE IF NOT EXISTS financial_data (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker      TEXT    NOT NULL,
    quarter     INTEGER NOT NULL,
    year        INTEGER NOT NULL,
    report_type TEXT    NOT NULL,
    item_name   TEXT    NOT NULL,
    value       REAL    DEFAULT 0,
    UNIQUE (ticker, quarter, year, report_type, item_name)
)
"""

def ensure_master_schema(engine_master):
    with engine_master.connect() as c:
        c.execute(text(MASTER_DDL))
        c.execute(text("CREATE INDEX IF NOT EXISTS idx_fd_ticker      ON financial_data (ticker)"))
        c.execute(text("CREATE INDEX IF NOT EXISTS idx_fd_year        ON financial_data (year, quarter)"))
        c.execute(text("CREATE INDEX IF NOT EXISTS idx_fd_report_type ON financial_data (report_type)"))
        c.commit()
    print("✅ Master schema (financial_data) sẵn sàng\n")


# ==============================================================================
# DETECT SCHEMA
# ==============================================================================
def detect_schema(inspector) -> str:
    tables = set(inspector.get_table_names())
    if "financial_data"    in tables: return "financial_data"   # V3 / system
    if "financial_items"   in tables: return "financial_items"  # V2
    if "income_statements" in tables: return "wide"             # V1
    if "balance_sheets"    in tables: return "wide"
    return "unknown"


# ==============================================================================
# UPSERT helper
# ==============================================================================
_UPSERT_SQL = text("""
    INSERT INTO financial_data (ticker, quarter, year, report_type, item_name, value)
    VALUES (:ticker, :quarter, :year, :report_type, :item_name, :value)
    ON CONFLICT(ticker, quarter, year, report_type, item_name)
    DO UPDATE SET value = excluded.value
""")

def _upsert_batch(engine_master, records: list[dict]) -> int:
    if not records:
        return 0
    with engine_master.connect() as c:
        for rec in records:
            c.execute(_UPSERT_SQL, rec)
        c.commit()
    return len(records)


# ==============================================================================
# SYNC 1: financial_data → financial_data
# ==============================================================================
def sync_financial_data(engine_master, engine_source) -> int:
    with engine_source.connect() as c:
        rows = c.execute(text(
            "SELECT ticker, quarter, year, report_type, item_name, value "
            "FROM financial_data"
        )).fetchall()

    records = [
        {
            "ticker":      r[0] or "",
            "quarter":     int(r[1] or 0),
            "year":        int(r[2] or 0),
            "report_type": r[3] or "",
            "item_name":   (r[4] or "").strip(),
            "value":       float(r[5] or 0),
        }
        for r in rows
        if r[0] and r[2] and r[4]
    ]
    return _upsert_batch(engine_master, records)


# ==============================================================================
# SYNC 2: financial_items → financial_data  (pipeline V2)
# ==============================================================================
def sync_financial_items(engine_master, engine_source, ticker: str) -> int:
    with engine_source.connect() as c:
        rows = c.execute(
            text("SELECT quarter, year, report_type, item_name, value "
                 "FROM financial_items WHERE ticker = :t"),
            {"t": ticker}
        ).fetchall()

    records = [
        {
            "ticker":      ticker,
            "quarter":     int(r[0] or 0),
            "year":        int(r[1] or 0),
            "report_type": r[2] or "",
            "item_name":   (r[3] or "").strip(),
            "value":       float(r[4] or 0),
        }
        for r in rows if r[1] and r[3]
    ]
    return _upsert_batch(engine_master, records)


# ==============================================================================
# SYNC 3: wide-format → financial_data  (pipeline V1)
# ==============================================================================
WIDE_TO_REPORT = {
    "income_statements": "KQKD",
    "balance_sheets":    "CDKT",
    "cash_flows":        "LCTT",
}

_YEAR_HINTS    = ["year", "period_year"]
_QUARTER_HINTS = ["quarter", "period_quarter"]
_NAME_HINTS    = ["item_name", "name", "chi_tieu", "label", "description"]
_VALUE_HINTS   = ["value", "current_value", "ky_nay", "period_value", "amount",
                  "current_period", "this_period"]

def _pick(cols: set, hints: list):
    for h in hints:
        if h in cols:
            return h
    return None


def sync_wide(engine_master, engine_source, inspector_source,
              ticker: str, company_id: int) -> int:
    src_tables = set(inspector_source.get_table_names())
    total      = 0

    for table, report_type in WIDE_TO_REPORT.items():
        if table not in src_tables:
            continue

        cols        = {c["name"] for c in inspector_source.get_columns(table)}
        year_col    = _pick(cols, _YEAR_HINTS)
        quarter_col = _pick(cols, _QUARTER_HINTS)
        name_col    = _pick(cols, _NAME_HINTS)
        value_col   = _pick(cols, _VALUE_HINTS)

        if not all([year_col, quarter_col, name_col, value_col]):
            # Fallback: mỗi cột số = 1 item
            n = _sync_wide_cols_as_items(
                engine_master, engine_source, table, report_type,
                ticker, company_id, year_col, quarter_col, cols
            )
            print(f"     [{report_type}] fallback-col: {n} rows")
            total += n
            continue

        with engine_source.connect() as c:
            rows = c.execute(
                text(f"SELECT {year_col}, {quarter_col}, {name_col}, {value_col} "
                     f"FROM {table} WHERE company_id = :cid"),
                {"cid": company_id}
            ).fetchall()

        records = [
            {
                "ticker":      ticker,
                "quarter":     int(r[1] or 0),
                "year":        int(r[0] or 0),
                "report_type": report_type,
                "item_name":   (r[2] or "").strip(),
                "value":       float(r[3] or 0),
            }
            for r in rows if r[0] and r[2]
        ]
        n = _upsert_batch(engine_master, records)
        print(f"     [{report_type}] {n} rows", end="  ")
        total += n

    return total


def _sync_wide_cols_as_items(engine_master, engine_source, table, report_type,
                              ticker, company_id, year_col, quarter_col, cols) -> int:
    """Khi không có name_col/value_col: mỗi cột số = 1 item_name."""
    skip = {"id", "company_id", year_col, quarter_col}
    skip = {s for s in skip if s}

    with engine_source.connect() as c:
        all_rows = c.execute(text(f"SELECT * FROM {table}")).fetchall()

    records = []
    for row in all_rows:
        d = dict(row._mapping)
        if d.get("company_id") != company_id:
            continue
        year    = d.get(year_col) if year_col else None
        quarter = d.get(quarter_col) or 0 if quarter_col else 0
        if not year:
            continue
        for col, val in d.items():
            if col in skip:
                continue
            try:
                fval = float(val)
            except (TypeError, ValueError):
                continue
            records.append({
                "ticker":      ticker,
                "quarter":     int(quarter),
                "year":        int(year),
                "report_type": report_type,
                "item_name":   col,
                "value":       fval,
            })

    return _upsert_batch(engine_master, records)


# ==============================================================================
# MAIN
# ==============================================================================
def merge_databases():
    print("=" * 60)
    print("MERGE TOOL v6 — Schema: financial_data")
    print("=" * 60)

    engine_master = create_engine(f"sqlite:///{MASTER_DB_PATH}")
    ensure_master_schema(engine_master)

    db_files = glob.glob(os.path.join(SOURCE_FOLDER, "*.db"))
    if not db_files:
        print(f"❌ Không có file .db nào trong: {SOURCE_FOLDER}")
        return

    print(f"📂 {len(db_files)} file: {[os.path.basename(f) for f in db_files]}\n")
    grand_total = 0

    for db_file in db_files:
        print(f"\n{'─'*50}")
        print(f"🔄 {os.path.basename(db_file)}")

        try:
            engine_source    = create_engine(f"sqlite:///{db_file}")
            inspector_source = inspect(engine_source)
            src_tables       = inspector_source.get_table_names()
            schema           = detect_schema(inspector_source)

            print(f"   Bảng   : {src_tables}")
            print(f"   Schema : {schema}")

            if schema == "unknown":
                print("   ⚠️  Không nhận ra schema, bỏ qua")
                continue

            # ── financial_data ──────────────────────────────────────────────
            if schema == "financial_data":
                with engine_source.connect() as c:
                    n_src    = c.execute(text("SELECT COUNT(*) FROM financial_data")).scalar()
                    tickers  = [r[0] for r in c.execute(
                        text("SELECT DISTINCT ticker FROM financial_data")).fetchall()]
                print(f"   Rows   : {n_src:,}  |  Tickers: {tickers}")
                n = sync_financial_data(engine_master, engine_source)
                print(f"   ✅ Synced {n:,} rows")
                grand_total += n
                continue

            # ── financial_items (V2) ────────────────────────────────────────
            if schema == "financial_items":
                with engine_source.connect() as c:
                    tickers = [r[0] for r in c.execute(
                        text("SELECT DISTINCT ticker FROM financial_items")).fetchall()]
                for ticker in tickers:
                    n = sync_financial_items(engine_master, engine_source, ticker)
                    print(f"   + {ticker}: {n} rows")
                    grand_total += n
                continue

            # ── wide-format (V1) ────────────────────────────────────────────
            if schema == "wide":
                if "companies" not in src_tables:
                    print("   ⚠️  Wide-format nhưng không có bảng companies, bỏ qua")
                    continue

                with engine_source.connect() as c:
                    companies = c.execute(
                        text("SELECT id, ticker FROM companies")
                    ).fetchall()

                for (cid, ticker) in companies:
                    print(f"   + {ticker}:")
                    n = sync_wide(engine_master, engine_source,
                                  inspector_source, ticker, cid)
                    print(f"  → {n} rows")
                    grand_total += n

        except Exception as e:
            print(f"   ❌ Lỗi: {e}")
            traceback.print_exc()

    print("\n" + "=" * 60)
    print(f"🎉 HOÀN TẤT — {grand_total:,} rows đã gộp vào master.db")
    print("=" * 60)
    _preview_master(engine_master)


def _preview_master(engine_master):
    print("\n📊 MASTER DB:")
    with engine_master.connect() as c:
        total = c.execute(text("SELECT COUNT(*) FROM financial_data")).scalar()
        print(f"  Total rows: {total:,}")

        print("\n  Breakdown ticker × report_type:")
        for r in c.execute(text(
            "SELECT ticker, report_type, COUNT(*) "
            "FROM financial_data "
            "GROUP BY ticker, report_type "
            "ORDER BY ticker, report_type"
        )).fetchall():
            print(f"    {r[0]:10s} | {r[1]:6s}: {r[2]:,}")

        print("\n  Sample rows:")
        for r in c.execute(text(
            "SELECT ticker, quarter, year, report_type, item_name, value "
            "FROM financial_data LIMIT 5"
        )).fetchall():
            print(f"    {r}")


if __name__ == "__main__":
    merge_databases()