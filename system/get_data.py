import pandas as pd
from vnstock import Vnstock
import sqlite3
import time
import os

# --- CẤU HÌNH ---
DB_PATH = r"D:\X1G8\GR2\FinancialApp\financial_system.db"
START_YEAR = 2023
# Bạn có thể thêm hàng chục mã vào đây mà vẫn an toàn
SYMBOLS = [ 
# "VCB","BID","CTG","TCB","VPB","MBB","ACB","HDB","STB","TPB",
#             "VIC","VHM","VRE","NVL","PDR","KDH","DXG","DIG","CEO","SCR",
#             "HPG","HSG","NKG","GAS",
            # "PLX","POW","REE","PC1","PVS","PVD",
            # "FPT","CMG","ELC","SAM","DGW","MWG","PNJ","FRT","VGI","CTR",
            # "VNM","MSN","SAB","KDC","QNS","BAF","DBC","HAG","HNG","PAN",
            # "VJC","HVN","VTP","GMD","HAH","VSC","SCS","TMS","ACV","AST",
            # "SSI","VND","HCM","VCI","MBS","SHS","FTS","BVS","VDS","CTS",
            # "DGC","DCM","DPM","CSV","LAS","BFC","PHR","TRC","DPR","GVR",
            # "NT2","PPC","HND","QTP","GEG","REE","POW","NTC","SZC","IDC",
            # "BMP","NTP","AAA","APH","TNG","STK","GIL","MSH","VGT","ADS",
            # "HBC","CTD","CII","FCN","LCG","HHV","KSB","HT1","BCC","BTS",
            # "VHC","ANV","IDI","CMX","FMC","ACL","ABT","AGF","TS4","SEA",
            # "BVH","BMI","PVI","BIC","VNR","MIG","PTI","ABI","AIC","PGI",
            # "DHG","DMC","IMP","TRA","OPC","PMC","DBD","DP3","TW3","DVN",
            # "SBT","LSS","KTS","QNS",
            # "MIA",
            # "HSL","NAF","AFX","VOC","VSF",
            # "VIB","EIB","OCB","MSB","LPB","NAB","BAB","BVB","SSB","KLB",
            # "VIX","APS","ORS","AGR","TVS","TVB","APG","AAS","EVS","IVS",
            # "KBC","ITA","SZL","TIP","IDC","BCM","KHG","NLG","IJC","HDG",
            # "FOX","VGI","CTR","TTN","SGT","CMG","ELC","ONE","ICT","SMT",
            # "HUT","C4G","HHV","LCG","DHA","VLB","KSB","BMC","YBM","HGM",
            # "PVT","VIP","VOS","VNA","MVN","SGN","ACV",
            "NCT","TCL","SCS",
            "VSH","CHP","TBC","SJD","TMP","DRL","SBH","HJS","TTE","VPD",
            "AAA","APH","NHH","DPR","DRC","CSM","SRC","PAC","SVC","TMT"] 

def init_system_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS financial_data (
            ticker TEXT, quarter INTEGER, year INTEGER, 
            report_type TEXT, item_name TEXT, value REAL,
            PRIMARY KEY (ticker, quarter, year, report_type, item_name)
        )
    ''')
    conn.commit()
    return conn

def crawl_full_system_data():
    conn = init_system_db()
    stock_api = Vnstock()
    # Danh sách báo cáo
    reports = {
        'income_statement': 'KQKD', 
        'balance_sheet': 'CDKT', 
        'cash_flow': 'LCTT'
    }

    total_symbols = len(SYMBOLS)
    
    for index, symbol in enumerate(SYMBOLS):
        print(f"\n🚀 [{index+1}/{total_symbols}] Đang xử lý mã: {symbol}")
        stock = stock_api.stock(symbol=symbol, source='VCI')
        
        for func_name, label in reports.items():
            try:
                # Gọi API lấy dữ liệu
                df = getattr(stock.finance, func_name)(period='quarter', lang='vi')
                
                if df is None or df.empty:
                    print(f"   [!] Bảng {label} của {symbol} không có dữ liệu.")
                    continue

                # Chuẩn hóa cột và lọc năm
                df.columns = [str(c).strip() for c in df.columns]
                df_filtered = df[df['Năm'] >= START_YEAR]
                
                rows_inserted = 0
                for _, row in df_filtered.iterrows():
                    ticker = row['CP']
                    year = int(row['Năm'])
                    # Trích xuất số quý
                    quarter_str = str(row['Kỳ'])
                    quarter = int(''.join(filter(str.isdigit, quarter_str)))
                    
                    for col in df.columns:
                        if col not in ['CP', 'Năm', 'Kỳ', 'index', 'symbol']:
                            val = row[col]
                            if pd.isna(val): val = 0
                            
                            conn.execute('''
                                INSERT OR REPLACE INTO financial_data 
                                (ticker, quarter, year, report_type, item_name, value)
                                VALUES (?, ?, ?, ?, ?, ?)
                            ''', (ticker, quarter, year, label, col, val))
                            rows_inserted += 1
                
                conn.commit()
                # Log chi tiết số dòng để bạn dễ kiểm tra
                print(f"   ✅ Bảng {label}: Đã nạp thành công {rows_inserted} chỉ tiêu.")
                
                # Nghỉ ngắn giữa các bảng (tránh spam API)
                time.sleep(3) 

            except Exception as e:
                if "Rate Limit" in str(e) or "limit" in str(e).lower():
                    print("   ⚠️ Chạm giới hạn API. Đang nghỉ 30 giây để reset...")
                    time.sleep(30)
                else:
                    print(f"   ❌ Lỗi tại bảng {label} của {symbol}: {e}")

        # NGHỈ DÀI 15 GIÂY (Theo yêu cầu của bạn để chạy pipeline nhiều mã an toàn)
        if index < total_symbols - 1:
            print(f"--- Đã xong {symbol}. Nghỉ 20 giây để bảo vệ IP... ---")
            time.sleep(20)

    conn.close()
    print(f"\n" + "="*40)
    print(f"🏆 HOÀN THÀNH CÀO {total_symbols} MÃ CHỨNG KHOÁN")
    print(f"📂 Dữ liệu lưu tại: {DB_PATH}")
    print("="*40)

if __name__ == "__main__":
    crawl_full_system_data()