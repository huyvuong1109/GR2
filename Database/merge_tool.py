"""
merge_tool.py - Công cụ gộp nhiều database từ Kaggle vào master.db
Phiên bản 3: Pure Raw SQL để xử lý schema khác nhau
"""
import os
import glob
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from models import Base, Company, BalanceSheet, IncomeStatement, CashFlow

# --- CẤU HÌNH ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_FOLDER = os.path.join(SCRIPT_DIR, "new_db_from_kaggle")
MASTER_DB_FOLDER = os.path.join(SCRIPT_DIR, "master_db")
MASTER_DB_PATH = f"sqlite:///{os.path.join(MASTER_DB_FOLDER, 'master.db')}"

os.makedirs(MASTER_DB_FOLDER, exist_ok=True)
os.makedirs(SOURCE_FOLDER, exist_ok=True)

print(f"📁 Script directory: {SCRIPT_DIR}")
print(f"📁 Source folder: {SOURCE_FOLDER}")
print(f"📁 Master DB: {MASTER_DB_PATH}")
print()

def merge_databases():
    """Gộp các database từ SOURCE_FOLDER vào master.db"""
    print("=" * 60)
    print("CÔNG CỤ GỘP DATABASE - Xử lý Schema Khác Nhau")
    print("=" * 60)

    # Tạo master database
    engine_master = create_engine(MASTER_DB_PATH)
    Base.metadata.create_all(engine_master)
    SessionMaster = sessionmaker(bind=engine_master)
    session_master = SessionMaster()
    
    # Lấy schema của master DB
    inspector_master = inspect(engine_master)
    master_tables = inspector_master.get_table_names()

    # Tìm file DB trong thư mục nguồn
    db_files = glob.glob(os.path.join(SOURCE_FOLDER, "*.db"))
    if not db_files:
        print(f"❌ Không tìm thấy file .db nào trong: {SOURCE_FOLDER}")
        print(f"   Vui lòng đặt file database vào thư mục này!")
        return

    print(f"📂 Tìm thấy {len(db_files)} file database cần gộp:")
    for f in db_files:
        print(f"   - {os.path.basename(f)}")
    print()

    # Xử lý từng database
    for db_file in db_files:
        print(f"\n🔄 Đang xử lý: {os.path.basename(db_file)}...")
        
        try:
            engine_source = create_engine(f"sqlite:///{db_file}")
            inspector_source = inspect(engine_source)
            
            # Kiểm tra bảng companies
            if 'companies' not in inspector_source.get_table_names():
                print(f"   ⚠️  Bỏ qua: Không có bảng 'companies'")
                continue
            
            # Schema info
            source_company_cols = {col['name'] for col in inspector_source.get_columns('companies')}
            master_company_cols = {col['name'] for col in inspector_master.get_columns('companies')}
            common_company_cols = (source_company_cols & master_company_cols) - {'id'}
            
            print(f"   📋 Schema companies: {', '.join(sorted(source_company_cols))}")
            print(f"   🔗 Cột chung: {len(common_company_cols)} cột")
            
            # Đọc companies từ source
            with engine_source.connect() as conn_src:
                companies_result = conn_src.execute(text("SELECT * FROM companies")).fetchall()
                
                if not companies_result:
                    print(f"   ⚠️  Bỏ qua: Không có dữ liệu")
                    continue
                
                # Xử lý từng company
                for comp_row in companies_result:
                    comp_data = dict(comp_row._mapping)
                    ticker = comp_data.get('ticker')
                    source_company_id = comp_data.get('id')
                    
                    if not ticker or not source_company_id:
                        print(f"   ⚠️  Bỏ qua 1 company: thiếu ticker hoặc id")
                        continue
                    
                    # A. Đồng bộ Company (dùng Raw SQL để tránh schema mismatch)
                    # Kiểm tra xem ticker đã tồn tại chưa
                    with engine_master.connect() as conn_master_check:
                        existing = conn_master_check.execute(
                            text("SELECT id FROM companies WHERE ticker = :ticker"),
                            {"ticker": ticker}
                        ).first()
                    
                    if not existing:
                        print(f"   + Thêm mới: {ticker}")
                        # INSERT company mới
                        insert_data = {k: v for k, v in comp_data.items() if k in common_company_cols}
                        cols = ', '.join(insert_data.keys())
                        placeholders = ', '.join([f':{k}' for k in insert_data.keys()])
                        insert_sql = f"INSERT INTO companies ({cols}) VALUES ({placeholders})"
                        
                        with engine_master.connect() as conn_master_ins:
                            conn_master_ins.execute(text(insert_sql), insert_data)
                            conn_master_ins.commit()
                        
                        # Lấy ID vừa insert
                        with engine_master.connect() as conn_master_getid:
                            master_company_id = conn_master_getid.execute(
                                text("SELECT id FROM companies WHERE ticker = :ticker"),
                                {"ticker": ticker}
                            ).scalar()
                    else:
                        master_company_id = existing[0]
                        print(f"   . Cập nhật: {ticker}")
                        # UPDATE company
                        update_parts = []
                        update_data = {"ticker": ticker}
                        for col in common_company_cols:
                            if col != 'ticker' and col in comp_data and comp_data[col]:
                                update_parts.append(f"{col} = :{col}")
                                update_data[col] = comp_data[col]
                        
                        if update_parts:
                            update_sql = f"UPDATE companies SET {', '.join(update_parts)} WHERE ticker = :ticker"
                            with engine_master.connect() as conn_master_upd:
                                conn_master_upd.execute(text(update_sql), update_data)
                                conn_master_upd.commit()
                    
                    session_master.commit()  # Commit ORM session nếu có thay đổi
                    
                    # B. Đồng bộ Financial Reports (Raw SQL)
                    def sync_financial_reports(table_name: str):
                        """Sync reports sử dụng pure raw SQL"""
                        if table_name not in inspector_source.get_table_names():
                            return 0
                        if table_name not in master_tables:
                            return 0
                        
                        # Lấy schema
                        source_cols = {col['name'] for col in inspector_source.get_columns(table_name)}
                        master_cols = {col['name'] for col in inspector_master.get_columns(table_name)}
                        common_cols = (source_cols & master_cols) - {'id', 'company_id'}
                        
                        if not common_cols:
                            return 0
                        
                        # Đọc tất cả records của company từ source
                        select_sql = f"SELECT * FROM {table_name} WHERE company_id = :cid"
                        reports = conn_src.execute(text(select_sql), {"cid": source_company_id}).fetchall()
                        
                        if not reports:
                            return 0
                        
                        # Xóa và insert lại bằng raw SQL
                        with engine_master.connect() as conn_master:
                            for report_row in reports:
                                report_data = dict(report_row._mapping)
                                
                                # Xóa record cũ (match theo period)
                                py = report_data.get('period_year')
                                pq = report_data.get('period_quarter')
                                pt = report_data.get('period_type')
                                
                                if py:
                                    del_sql = f"DELETE FROM {table_name} WHERE company_id = :cid AND period_year = :py"
                                    del_params = {"cid": master_company_id, "py": py}
                                    
                                    if pq is not None and 'period_quarter' in common_cols:
                                        del_sql += " AND period_quarter = :pq"
                                        del_params["pq"] = pq
                                    if pt and 'period_type' in common_cols:
                                        del_sql += " AND period_type = :pt"
                                        del_params["pt"] = pt
                                    
                                    conn_master.execute(text(del_sql), del_params)
                                    conn_master.commit()
                                
                                # Prepare insert data
                                insert_data = {k: v for k, v in report_data.items() if k in common_cols}
                                insert_data['company_id'] = master_company_id
                                
                                # Build INSERT
                                cols = ', '.join(insert_data.keys())
                                placeholders = ', '.join([f':{k}' for k in insert_data.keys()])
                                insert_sql = f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})"
                                
                                conn_master.execute(text(insert_sql), insert_data)
                                conn_master.commit()
                        
                        return len(reports)
                    
                    # Sync 3 bảng báo cáo
                    n_bs = sync_financial_reports('balance_sheets')
                    n_is = sync_financial_reports('income_statements')
                    n_cf = sync_financial_reports('cash_flows')
                    
                    print(f"     -> Gộp: {n_bs} BS, {n_is} IS, {n_cf} CF")

            session_master.commit()
            print("✅ Gộp thành công!")
            
        except Exception as e:
            session_master.rollback()
            print(f"❌ Lỗi: {e}")
            import traceback
            traceback.print_exc()

    session_master.close()
    print("\n" + "=" * 60)
    print("🎉 HOÀN TẤT! Dữ liệu đã được gộp vào master.db")
    print("=" * 60)

if __name__ == "__main__":
    merge_databases()
