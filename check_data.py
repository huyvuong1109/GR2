import sqlite3
import pandas as pd

# Đường dẫn tới file DB hệ thống của bạn
DB_PATH = r"D:\X1G8\GR2\FinancialApp\financial_system.db"

def check_database_summary():
    try:
        conn = sqlite3.connect(DB_PATH)
        
        # 1. Lấy tổng số mã duy nhất
        total_query = "SELECT COUNT(DISTINCT ticker) FROM financial_data"
        total_tickers = conn.execute(total_query).fetchone()[0]
        
        # 2. Lấy chi tiết từng mã
        detail_query = """
        SELECT 
            ticker AS 'Mã CK', 
            COUNT(DISTINCT report_type) AS 'Số loại BCTC',
            COUNT(DISTINCT year || '-' || quarter) AS 'Số Quý',
            COUNT(*) AS 'Tổng dòng dữ liệu'
        FROM financial_data
        GROUP BY ticker
        ORDER BY ticker ASC;
        """
        df_detail = pd.read_sql(detail_query, conn)
        
        # 3. Hiển thị báo cáo
        print("\n" + "="*60)
        print(f"📊 BÁO CÁO TIẾN ĐỘ HỆ THỐNG DỮ LIỆU")
        print("="*60)
        print(f"✅ TỔNG SỐ MÃ ĐÃ CÀO THÀNH CÔNG: {total_tickers} mã")
        print("-" * 60)
        
        if df_detail.empty:
            print("❌ Database hiện tại đang trống!")
        else:
            # Hiển thị bảng chi tiết
            print(df_detail.to_string(index=False))
            
            # Thống kê nhanh về độ đầy đủ
            full_data = df_detail[df_detail['Số loại BCTC'] == 3]
            missing_data = df_detail[df_detail['Số loại BCTC'] < 3]
            
            print("-" * 60)
            print(f"💎 Mã đủ 3 bảng (KQKD, CDKT, LCTT): {len(full_data)}")
            if len(missing_data) > 0:
                print(f"⚠️ Mã bị thiếu bảng báo cáo: {len(missing_data)}")
                print(f"👉 Các mã thiếu: {missing_data['Mã CK'].tolist()}")
        
        print("="*60 + "\n")
        conn.close()

    except Exception as e:
        print(f"❌ Lỗi truy vấn Database: {e}")

if __name__ == "__main__":
    check_database_summary()