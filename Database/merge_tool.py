"""
merge_tool.py - Phiên bản 4: Tương thích schema year/quarter
"""
import os
import glob
from sqlalchemy import create_engine, inspect, text

# --- CẤU HÌNH ---
SCRIPT_DIR       = os.path.dirname(os.path.abspath(__file__))
SOURCE_FOLDER    = os.path.join(SCRIPT_DIR, "new_db_from_kaggle")
MASTER_DB_FOLDER = os.path.join(SCRIPT_DIR, "master_db")
MASTER_DB_PATH   = os.path.join(MASTER_DB_FOLDER, "master.db")

os.makedirs(MASTER_DB_FOLDER, exist_ok=True)
os.makedirs(SOURCE_FOLDER,    exist_ok=True)

# Bảng tài chính cần sync và cột định danh period của mỗi bảng
FINANCIAL_TABLES = ["income_statements", "balance_sheets", "cash_flows"]

# ==============================================================================
# DETECT PERIOD COLUMNS — tự động nhận ra schema dù dùng year/quarter
# hay period_year/period_quarter
# ==============================================================================
def detect_period_cols(inspector, table_name: str) -> tuple[str, str] | None:
    """
    Trả về (year_col, quarter_col) hoặc None nếu không tìm được.
    Hỗ trợ cả 2 kiểu đặt tên:
      - year / quarter  (schema mới của bạn)
      - period_year / period_quarter  (schema cũ merge_tool)
    """
    cols = {c["name"] for c in inspector.get_columns(table_name)}
    if "year" in cols and "quarter" in cols:
        return "year", "quarter"
    if "period_year" in cols and "period_quarter" in cols:
        return "period_year", "period_quarter"
    return None


# ==============================================================================
# KHỞI TẠO MASTER DB — tạo bảng nếu chưa có, dựa trên schema source
# ==============================================================================
def ensure_master_schema(engine_master, engine_source):
    """
    Với mỗi bảng trong source mà master chưa có:
    tạo bảng trong master với cùng schema.
    Không xoá hay sửa bảng đã tồn tại.
    """
    inspector_src    = inspect(engine_source)
    inspector_master = inspect(engine_master)
    existing_tables  = set(inspector_master.get_table_names())

    for table in inspector_src.get_table_names():
        if table in existing_tables:
            continue
        # Tạo bảng giống source
        with engine_source.connect() as c:
            ddl = c.execute(
                text("SELECT sql FROM sqlite_master WHERE type='table' AND name=:t"),
                {"t": table}
            ).scalar()
        if ddl:
            with engine_master.connect() as c:
                c.execute(text(ddl))
                c.commit()
            print(f"   + Tạo bảng mới trong master: {table}")


# ==============================================================================
# SYNC MỘT BẢNG TÀI CHÍNH
# ==============================================================================
def sync_table(engine_master, engine_source,
               inspector_master, inspector_source,
               table_name: str,
               source_company_id: int,
               master_company_id: int) -> int:
    """
    Trả về số record đã sync.
    Dùng INSERT OR REPLACE để tránh duplicate.
    """
    src_tables    = inspector_source.get_table_names()
    master_tables = inspector_master.get_table_names()

    if table_name not in src_tables or table_name not in master_tables:
        return 0

    # Cột chung (bỏ id và company_id vì sẽ map lại)
    src_cols    = {c["name"] for c in inspector_source.get_columns(table_name)}
    master_cols = {c["name"] for c in inspector_master.get_columns(table_name)}
    common_cols = (src_cols & master_cols) - {"id", "company_id"}

    if not common_cols:
        return 0

    # Detect period columns trong source
    period = detect_period_cols(inspector_source, table_name)
    if period is None:
        print(f"     ⚠️  [{table_name}] Không xác định được cột period, bỏ qua")
        return 0

    year_col, quarter_col = period

    # Đọc records từ source
    with engine_source.connect() as c_src:
        rows = c_src.execute(
            text(f"SELECT * FROM {table_name} WHERE company_id = :cid"),
            {"cid": source_company_id}
        ).fetchall()

    if not rows:
        return 0

    # Tìm tên cột tương ứng trong master (có thể khác prefix)
    master_period = detect_period_cols(inspector_master, table_name)
    if master_period is None:
        print(f"     ⚠️  [{table_name}] Master không có cột period, bỏ qua")
        return 0
    master_year_col, master_quarter_col = master_period

    count = 0
    with engine_master.connect() as c_master:
        for row in rows:
            data = dict(row._mapping)
            year_val    = data.get(year_col)
            quarter_val = data.get(quarter_col)

            if year_val is None:
                continue

            # Xoá record cũ trước khi insert (tránh duplicate)
            c_master.execute(text(
                f"DELETE FROM {table_name} "
                f"WHERE company_id = :cid "
                f"AND {master_year_col} = :yr "
                f"AND {master_quarter_col} = :qr"
            ), {"cid": master_company_id, "yr": year_val, "qr": quarter_val})

            # Build insert — chỉ lấy cột chung, map lại company_id
            insert_data = {}
            for col in common_cols:
                # Nếu source dùng period_year nhưng master dùng year → map
                master_col = col
                if col == "period_year"    and "year"    in master_cols: master_col = "year"
                if col == "period_quarter" and "quarter" in master_cols: master_col = "quarter"
                if master_col in master_cols:
                    insert_data[master_col] = data.get(col, 0)

            insert_data["company_id"] = master_company_id

            cols_str  = ", ".join(insert_data.keys())
            vals_str  = ", ".join(f":{k}" for k in insert_data.keys())
            c_master.execute(
                text(f"INSERT INTO {table_name} ({cols_str}) VALUES ({vals_str})"),
                insert_data
            )
            count += 1

        c_master.commit()

    return count


# ==============================================================================
# MAIN
# ==============================================================================
def merge_databases():
    print("=" * 60)
    print("MERGE TOOL v4 — Tương thích schema year/quarter")
    print("=" * 60)

    engine_master    = create_engine(f"sqlite:///{MASTER_DB_PATH}")
    inspector_master = inspect(engine_master)

    db_files = glob.glob(os.path.join(SOURCE_FOLDER, "*.db"))
    if not db_files:
        print(f"❌ Không có file .db nào trong: {SOURCE_FOLDER}")
        return

    print(f"📂 {len(db_files)} file cần gộp: {[os.path.basename(f) for f in db_files]}\n")

    for db_file in db_files:
        print(f"\n{'─'*50}")
        print(f"🔄 {os.path.basename(db_file)}")

        try:
            engine_source    = create_engine(f"sqlite:///{db_file}")
            inspector_source = inspect(engine_source)

            if "companies" not in inspector_source.get_table_names():
                print("   ⚠️  Không có bảng companies, bỏ qua")
                continue

            # Đảm bảo master có đủ bảng
            ensure_master_schema(engine_master, engine_source)
            # Refresh inspector sau khi thêm bảng mới
            inspector_master = inspect(engine_master)

            # Lấy danh sách companies từ source
            with engine_source.connect() as c:
                companies = c.execute(text("SELECT * FROM companies")).fetchall()

            total_bs = total_is = total_cf = 0

            for comp_row in companies:
                comp       = dict(comp_row._mapping)
                ticker     = comp.get("ticker")
                src_cid    = comp.get("id")

                if not ticker or src_cid is None:
                    continue

                # Upsert company trong master
                with engine_master.connect() as c:
                    existing_id = c.execute(
                        text("SELECT id FROM companies WHERE ticker = :t"),
                        {"t": ticker}
                    ).scalar()

                if existing_id is None:
                    # INSERT company mới
                    src_comp_cols = {col["name"] for col in inspector_source.get_columns("companies")}
                    master_comp_cols = {col["name"] for col in inspector_master.get_columns("companies")}
                    shared = (src_comp_cols & master_comp_cols) - {"id"}

                    ins_data = {k: comp[k] for k in shared if k in comp}
                    cols_s   = ", ".join(ins_data.keys())
                    vals_s   = ", ".join(f":{k}" for k in ins_data.keys())

                    with engine_master.connect() as c:
                        c.execute(text(f"INSERT INTO companies ({cols_s}) VALUES ({vals_s})"), ins_data)
                        c.commit()
                        master_cid = c.execute(
                            text("SELECT id FROM companies WHERE ticker = :t"),
                            {"t": ticker}
                        ).scalar()
                    print(f"   + Thêm mới: {ticker}")
                else:
                    master_cid = existing_id
                    # UPDATE name và industry_type nếu source có
                    upd = {}
                    if comp.get("name"):          upd["name"]          = comp["name"]
                    if comp.get("industry_type"): upd["industry_type"] = comp["industry_type"]
                    if upd:
                        set_clause = ", ".join(f"{k}=:{k}" for k in upd)
                        upd["ticker"] = ticker
                        with engine_master.connect() as c:
                            c.execute(text(f"UPDATE companies SET {set_clause} WHERE ticker=:ticker"), upd)
                            c.commit()
                    print(f"   . Cập nhật: {ticker}")

                # Sync 3 bảng tài chính
                n_bs = sync_table(engine_master, engine_source,
                                  inspector_master, inspector_source,
                                  "balance_sheets",     src_cid, master_cid)
                n_is = sync_table(engine_master, engine_source,
                                  inspector_master, inspector_source,
                                  "income_statements",  src_cid, master_cid)
                n_cf = sync_table(engine_master, engine_source,
                                  inspector_master, inspector_source,
                                  "cash_flows",         src_cid, master_cid)

                # Sync extraction_logs nếu có
                n_log = sync_table(engine_master, engine_source,
                                   inspector_master, inspector_source,
                                   "extraction_logs",   src_cid, master_cid)

                total_bs += n_bs; total_is += n_is; total_cf += n_cf
                print(f"     → {ticker}: {n_bs} BS | {n_is} IS | {n_cf} CF | {n_log} logs")

            print(f"   ✅ Tổng: {total_bs} BS | {total_is} IS | {total_cf} CF")

        except Exception as e:
            import traceback
            print(f"   ❌ Lỗi: {e}")
            traceback.print_exc()

    print("\n" + "=" * 60)
    print("🎉 HOÀN TẤT")
    print("=" * 60)

    # Kiểm tra nhanh kết quả
    with engine_master.connect() as c:
        n_comp = c.execute(text("SELECT COUNT(*) FROM companies")).scalar()
        n_is   = c.execute(text("SELECT COUNT(*) FROM income_statements")).scalar()
        n_bs   = c.execute(text("SELECT COUNT(*) FROM balance_sheets")).scalar()
        n_cf   = c.execute(text("SELECT COUNT(*) FROM cash_flows")).scalar()
    print(f"\n📊 Master DB: {n_comp} công ty | {n_is} IS | {n_bs} BS | {n_cf} CF")


if __name__ == "__main__":
    merge_databases()