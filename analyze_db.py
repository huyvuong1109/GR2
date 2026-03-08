"""
Script để phân tích cấu trúc database thực tế
"""
import sqlite3
import pandas as pd

# Kết nối database
conn = sqlite3.connect('Database/financial_data.db')

print("=" * 80)
print("PHÂN TÍCH DATABASE FINANCIAL_DATA.DB")
print("=" * 80)

# Lấy danh sách bảng
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in cursor.fetchall()]

print(f"\n📊 Tìm thấy {len(tables)} bảng:")
for table in tables:
    print(f"  - {table}")

print("\n" + "=" * 80)

# Phân tích từng bảng
for table in tables:
    print(f"\n🔍 BẢNG: {table}")
    print("-" * 80)
    
    # Schema
    cursor.execute(f"PRAGMA table_info({table})")
    columns = cursor.fetchall()
    
    print(f"\n📋 Schema ({len(columns)} cột):")
    for col in columns:
        col_id, col_name, col_type, not_null, default, pk = col
        pk_marker = " [PK]" if pk else ""
        null_marker = " NOT NULL" if not_null else ""
        print(f"  {col_name:<30} {col_type:<15}{pk_marker}{null_marker}")
    
    # Số lượng records
    cursor.execute(f"SELECT COUNT(*) FROM {table}")
    count = cursor.fetchone()[0]
    print(f"\n📈 Số lượng records: {count}")
    
    # Sample data
    if count > 0:
        print(f"\n📄 Mẫu dữ liệu (5 dòng đầu):")
        df = pd.read_sql(f"SELECT * FROM {table} LIMIT 5", conn)
        print(df.to_string())
        
        # Check for NULL values
        print(f"\n⚠️ Kiểm tra NULL values:")
        null_counts = df.isnull().sum()
        if null_counts.any():
            print(null_counts[null_counts > 0])
        else:
            print("  Không có NULL values trong 5 dòng đầu")
    
    print("\n" + "=" * 80)

conn.close()

print("\n✅ Phân tích hoàn tất!")
