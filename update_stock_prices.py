"""
update_stock_prices.py - Cập nhật giá cổ phiếu realtime từ API
Chạy: python update_stock_prices.py

Nguồn dữ liệu: SSI API (miễn phí, không cần đăng ký)
"""
import os
import sys
import json
import time
import requests
from datetime import datetime
from sqlalchemy import create_engine, text

# Database path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "Database", "master_db", "master.db")

# SSI API endpoint (public, không cần auth)
SSI_API_URL = "https://iboard.ssi.com.vn/dchart/api/1.1/defaultAllStocks"

# TCBS API (backup)
TCBS_API_URL = "https://apipubaws.tcbs.com.vn/stock-insight/v1/stock/second-tc-price"

# VCI API (backup 2)
VCI_API_URL = "https://bgapidatafeed.vps.com.vn/getliststockdata"


def get_prices_from_ssi():
    """Lấy giá từ SSI API"""
    print("📡 Đang kết nối SSI API...")
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
        }
        response = requests.get(SSI_API_URL, headers=headers, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            # SSI trả về dict với key là mã CK
            prices = {}
            if isinstance(data, dict):
                for ticker, info in data.items():
                    if isinstance(info, dict):
                        # Lấy giá đóng cửa hoặc giá hiện tại
                        price = info.get('lastPrice') or info.get('closePrice') or info.get('matchPrice')
                        if price:
                            # SSI giá đơn vị 1000đ
                            prices[ticker.upper()] = float(price) * 1000
            print(f"✅ SSI: Lấy được {len(prices)} mã")
            return prices
    except Exception as e:
        print(f"❌ SSI API lỗi: {e}")
    return {}


def get_prices_from_tcbs(tickers: list):
    """Lấy giá từ TCBS API (lấy từng mã)"""
    print("📡 Đang kết nối TCBS API...")
    prices = {}
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
    }
    
    for ticker in tickers:
        try:
            url = f"{TCBS_API_URL}?ticker={ticker}"
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data and isinstance(data, dict):
                    price = data.get('price') or data.get('closePrice')
                    if price:
                        prices[ticker.upper()] = float(price) * 1000
                        print(f"  ✓ {ticker}: {price:,.0f}")
            time.sleep(0.2)  # Rate limit
        except Exception as e:
            print(f"  ✗ {ticker}: {e}")
    
    print(f"✅ TCBS: Lấy được {len(prices)} mã")
    return prices


def get_prices_from_vps(tickers: list):
    """Lấy giá từ VPS/VCI API"""
    print("📡 Đang kết nối VPS API...")
    
    try:
        # VPS API nhận list mã
        ticker_str = ",".join(tickers)
        url = f"{VCI_API_URL}/{ticker_str}"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            prices = {}
            
            if isinstance(data, list):
                for item in data:
                    ticker = item.get('sym', '').upper()
                    price = item.get('lastPrice') or item.get('c') or item.get('closePrice')
                    if ticker and price:
                        prices[ticker] = float(price) * 1000
            
            print(f"✅ VPS: Lấy được {len(prices)} mã")
            return prices
    except Exception as e:
        print(f"❌ VPS API lỗi: {e}")
    return {}


def get_prices_from_cafef(ticker: str):
    """Lấy giá từ CafeF (scraping - backup cuối)"""
    try:
        url = f"https://s.cafef.vn/Ajax/PageNew/DataHistory/PriceHistory.ashx?Symbol={ticker}&StartDate=&EndDate=&PageIndex=1&PageSize=1"
        headers = {
            'User-Agent': 'Mozilla/5.0',
        }
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('Data') and data['Data'].get('Data'):
                item = data['Data']['Data'][0]
                price = item.get('ClosePrice')
                if price:
                    return float(price) * 1000
    except:
        pass
    return None


def update_database(prices: dict):
    """Cập nhật giá vào database"""
    if not prices:
        print("⚠️  Không có dữ liệu giá để cập nhật")
        return 0
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Không tìm thấy database: {DB_PATH}")
        return 0
    
    engine = create_engine(f"sqlite:///{DB_PATH}")
    updated = 0
    
    with engine.connect() as conn:
        # Lấy danh sách ticker trong DB
        result = conn.execute(text("SELECT ticker FROM companies")).fetchall()
        db_tickers = [row[0].upper() for row in result]
        
        print(f"\n📊 Đang cập nhật {len(db_tickers)} mã trong database...")
        
        for ticker in db_tickers:
            if ticker in prices:
                price = prices[ticker]
                try:
                    conn.execute(
                        text("""
                            UPDATE companies 
                            SET current_price = :price,
                                market_cap = :price * shares_outstanding
                            WHERE UPPER(ticker) = :ticker
                        """),
                        {"price": price, "ticker": ticker}
                    )
                    updated += 1
                    print(f"  ✓ {ticker}: {price:,.0f}đ")
                except Exception as e:
                    print(f"  ✗ {ticker}: {e}")
        
        conn.commit()
    
    return updated


def ensure_price_columns():
    """Đảm bảo các cột giá tồn tại trong DB"""
    if not os.path.exists(DB_PATH):
        print(f"❌ Không tìm thấy database: {DB_PATH}")
        return False
    
    engine = create_engine(f"sqlite:///{DB_PATH}")
    
    with engine.connect() as conn:
        # Kiểm tra và thêm cột current_price
        try:
            conn.execute(text("SELECT current_price FROM companies LIMIT 1"))
        except:
            print("➕ Thêm cột current_price...")
            conn.execute(text("ALTER TABLE companies ADD COLUMN current_price REAL"))
            conn.commit()
        
        # Kiểm tra và thêm cột market_cap
        try:
            conn.execute(text("SELECT market_cap FROM companies LIMIT 1"))
        except:
            print("➕ Thêm cột market_cap...")
            conn.execute(text("ALTER TABLE companies ADD COLUMN market_cap BIGINT"))
            conn.commit()
        
        # Kiểm tra và thêm cột price_updated_at
        try:
            conn.execute(text("SELECT price_updated_at FROM companies LIMIT 1"))
        except:
            print("➕ Thêm cột price_updated_at...")
            conn.execute(text("ALTER TABLE companies ADD COLUMN price_updated_at TEXT"))
            conn.commit()
    
    return True


def main():
    print("=" * 60)
    print("🚀 CẬP NHẬT GIÁ CỔ PHIẾU REALTIME")
    print("=" * 60)
    print(f"📅 Thời gian: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📁 Database: {DB_PATH}")
    print()
    
    # Đảm bảo cột giá tồn tại
    if not ensure_price_columns():
        return
    
    # Lấy danh sách ticker từ DB
    engine = create_engine(f"sqlite:///{DB_PATH}")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT ticker FROM companies")).fetchall()
        db_tickers = [row[0].upper() for row in result]
    
    print(f"📋 Có {len(db_tickers)} mã trong database: {', '.join(db_tickers)}")
    print()
    
    # Thử lấy giá từ các nguồn
    prices = {}
    
    # 1. Thử SSI trước
    prices = get_prices_from_ssi()
    
    # 2. Nếu SSI không có, thử VPS
    missing = [t for t in db_tickers if t not in prices]
    if missing:
        print(f"\n⚠️  Còn thiếu {len(missing)} mã: {', '.join(missing)}")
        vps_prices = get_prices_from_vps(missing)
        prices.update(vps_prices)
    
    # 3. Nếu vẫn thiếu, thử TCBS
    missing = [t for t in db_tickers if t not in prices]
    if missing:
        print(f"\n⚠️  Còn thiếu {len(missing)} mã: {', '.join(missing)}")
        tcbs_prices = get_prices_from_tcbs(missing)
        prices.update(tcbs_prices)
    
    # 4. Cuối cùng, thử CafeF cho các mã còn lại
    missing = [t for t in db_tickers if t not in prices]
    if missing:
        print(f"\n⚠️  Thử CafeF cho {len(missing)} mã còn lại...")
        for ticker in missing:
            price = get_prices_from_cafef(ticker)
            if price:
                prices[ticker] = price
                print(f"  ✓ {ticker}: {price:,.0f}đ")
    
    # Cập nhật database
    print()
    updated = update_database(prices)
    
    # Cập nhật timestamp
    engine = create_engine(f"sqlite:///{DB_PATH}")
    with engine.connect() as conn:
        now = datetime.now().isoformat()
        conn.execute(text(f"UPDATE companies SET price_updated_at = '{now}'"))
        conn.commit()
    
    print()
    print("=" * 60)
    print(f"✅ HOÀN TẤT! Đã cập nhật {updated}/{len(db_tickers)} mã")
    print("=" * 60)
    
    # Hiển thị bảng giá
    print("\n📊 BẢNG GIÁ HIỆN TẠI:")
    print("-" * 50)
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT ticker, name, current_price, market_cap, shares_outstanding
            FROM companies
            ORDER BY market_cap DESC NULLS LAST
        """)).fetchall()
        
        for row in result:
            ticker, name, price, mcap, shares = row
            price_str = f"{price:,.0f}đ" if price else "N/A"
            mcap_str = f"{mcap/1e9:,.0f} tỷ" if mcap else "N/A"
            print(f"  {ticker:6} | {price_str:>15} | MCAP: {mcap_str:>12}")


if __name__ == "__main__":
    main()
