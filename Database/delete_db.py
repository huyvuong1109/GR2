import os

MASTER_DB_PATH = r"D:\X1G8\GR2\FinancialApp\Database\master_db\master.db"  # sửa đường dẫn cho đúng

if os.path.exists(MASTER_DB_PATH):
    os.remove(MASTER_DB_PATH)
    print(f"✅ Đã xoá: {MASTER_DB_PATH}")
else:
    print("⚠️  File không tồn tại, bỏ qua")