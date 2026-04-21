"""
FastAPI Backend - REST API for Financial Analysis App
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
import uvicorn
import pandas as pd
import numpy as np
import asyncio
import subprocess
import sys
import os
import json

from backend.database import get_db
from backend.config import APP_NAME, APP_VERSION, APP_DESCRIPTION, API_HOST, API_PORT, DATABASE_URL

# Global variable to track background task
price_update_task = None
price_update_running = False

def get_project_root():
    """Lấy đường dẫn thư mục gốc của project"""
    # __file__ = backend/main.py -> cần lên 1 cấp
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_ticker_groups(limit: int = 4) -> List[Dict[str, Any]]:
    """Đọc ticker_type.json và trả về 4 nhóm: bank, securities, insurance, corporate."""
    groups_path = os.path.join(get_project_root(), "ticker_type.json")
    if not os.path.exists(groups_path):
        return []

    with open(groups_path, "r", encoding="utf-8") as file:
        payload = json.load(file)

    ordered_types = [
        ("bank", "Ngan hang"),
        ("securities", "Chung khoan"),
        ("insurance", "Bao hiem"),
    ]

    grouped: List[Dict[str, Any]] = []
    known_tickers = set()

    for code, label in ordered_types:
        raw_tickers = payload.get(code, [])
        if not isinstance(raw_tickers, list):
            raw_tickers = []

        tickers = sorted({str(t).strip().upper() for t in raw_tickers if str(t).strip()})
        known_tickers.update(tickers)

        grouped.append(
            {
                "code": code,
                "label": label,
                "tickers": tickers,
                "count": len(tickers),
            }
        )

    corporate_tickers = sorted({str(t).strip().upper() for t in payload.get("corporate", []) if str(t).strip()})

    if not corporate_tickers:
        try:
            companies_df = db.get_all_companies()
            if not companies_df.empty and "ticker" in companies_df.columns:
                all_db_tickers = {
                    str(t).strip().upper()
                    for t in companies_df["ticker"].dropna().tolist()
                    if str(t).strip()
                }
                corporate_tickers = sorted(all_db_tickers - known_tickers)
        except Exception:
            corporate_tickers = []

    grouped.append(
        {
            "code": "corporate",
            "label": "Doanh nghiep",
            "tickers": corporate_tickers,
            "count": len(corporate_tickers),
        }
    )

    if limit > 0:
        return grouped[:limit]

    return grouped

def run_price_update_sync():
    """Chạy script cập nhật giá cổ phiếu (đồng bộ)"""
    global price_update_running
    
    if price_update_running:
        print("⏳ [Background] Đang có tiến trình cập nhật khác chạy, bỏ qua...")
        return
    
    price_update_running = True
    project_root = get_project_root()
    script_path = os.path.join(project_root, "update_stock_prices.py")
    
    if os.path.exists(script_path):
        try:
            print("📈 [Background] Đang cập nhật giá cổ phiếu...")
            # Thêm encoding UTF-8 cho subprocess
            env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'
            
            result = subprocess.run(
                [sys.executable, script_path],
                capture_output=True,
                text=True,
                timeout=120,
                cwd=project_root,
                env=env,
                encoding='utf-8',
                errors='replace'
            )
            
            if result.returncode == 0:
                # Lấy số mã đã cập nhật từ output
                output = result.stdout.strip()
                # Tìm dòng "HOÀN TẤT" để lấy số liệu
                import re
                match = re.search(r'Đã cập nhật (\d+)/(\d+) mã', output)
                if match:
                    updated, total = match.groups()
                    print(f"✅ [Background] Cập nhật giá thành công! ({updated}/{total} mã)")
                else:
                    print("✅ [Background] Cập nhật giá thành công!")
                
                # In bảng giá từ output (tìm phần BẢNG GIÁ)
                if "BẢNG GIÁ HIỆN TẠI:" in output:
                    price_section = output.split("BẢNG GIÁ HIỆN TẠI:")[-1]
                    lines = price_section.strip().split('\n')[1:]  # Bỏ dòng ---
                    print(f"📊 [Background] Giá hiện tại ({len(lines)} mã):")
                    for line in lines[:10]:  # 10 mã đầu
                        print(f"   {line}")
                    if len(lines) > 10:
                        print(f"   ... và {len(lines) - 10} mã khác")
            else:
                error_msg = result.stderr[:300] if result.stderr else "Unknown error"
                print(f"⚠️ [Background] Cập nhật giá có lỗi: {error_msg}")
        except subprocess.TimeoutExpired:
            print("⚠️ [Background] Cập nhật giá quá thời gian (2 phút), bỏ qua...")
        except Exception as e:
            print(f"⚠️ [Background] Lỗi cập nhật giá: {e}")
    else:
        print(f"⚠️ [Background] Không tìm thấy script: {script_path}")
    
    price_update_running = False

async def update_stock_prices_async():
    """Chạy script cập nhật giá cổ phiếu trong thread pool"""
    import concurrent.futures
    
    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor() as pool:
        await loop.run_in_executor(pool, run_price_update_sync)

async def periodic_price_update():
    """Task chạy ngầm cập nhật giá mỗi 2 phút"""
    # Cập nhật ngay khi khởi động
    await update_stock_prices_async()
    
    while True:
        # Đợi 2 phút
        await asyncio.sleep(120)  # 120 giây = 2 phút
        print(f"\n🔄 [Auto Update] Bắt đầu cập nhật giá định kỳ...")
        await update_stock_prices_async()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Quản lý vòng đời ứng dụng - khởi động và dừng background tasks"""
    global price_update_task
    
    print("🚀 Khởi động background task cập nhật giá cổ phiếu...")
    # Khởi động task cập nhật giá
    price_update_task = asyncio.create_task(periodic_price_update())
    
    yield  # Ứng dụng chạy
    
    # Cleanup khi shutdown
    print("🛑 Đang dừng background tasks...")
    if price_update_task:
        price_update_task.cancel()
        try:
            await price_update_task
        except asyncio.CancelledError:
            pass
    print("👋 Đã dừng tất cả background tasks")

# Initialize FastAPI app with lifespan
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database instance
db = get_db()


# ============ Pydantic Models ============

class CompanyResponse(BaseModel):
    id: int
    ticker: str
    name: str
    industry: Optional[str]
    market_cap: Optional[int]
    shares_outstanding: Optional[int]
    current_price: Optional[float]


class ScreenerFilters(BaseModel):
    min_roe: Optional[float] = None
    max_de: Optional[float] = None
    min_profit_growth: Optional[float] = None
    max_pe: Optional[float] = None


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str  # 'info', 'success', 'warning', 'danger'
    timestamp: str
    is_read: bool
    min_pe: Optional[float] = None
    max_pb: Optional[float] = None
    min_dividend_yield: Optional[float] = None
    consecutive_roe_years: Optional[int] = None
    industry: Optional[str] = None


class CompareRequest(BaseModel):
    tickers: List[str]


# ============ API Endpoints ============

@app.get("/")
async def root():
    """API Health check"""
    return {
        "message": f"Welcome to {APP_NAME}",
        "version": APP_VERSION,
        "status": "running",
        "price_update": "Auto-update every 2 minutes"
    }


@app.post("/api/prices/refresh")
async def refresh_prices():
    """Trigger cập nhật giá cổ phiếu thủ công"""
    from fastapi import BackgroundTasks
    
    # Chạy cập nhật trong background
    asyncio.create_task(update_stock_prices_async())
    
    return {
        "status": "started",
        "message": "Đang cập nhật giá cổ phiếu trong nền..."
    }


@app.get("/api/prices/status")
async def get_price_status():
    """Kiểm tra trạng thái cập nhật giá"""
    from sqlalchemy import text
    
    try:
        engine = db.engine
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT MAX(price_updated_at) as last_update
                FROM companies
                WHERE price_updated_at IS NOT NULL
            """)).fetchone()
            
            last_update = result[0] if result else None
            
        return {
            "status": "active",
            "auto_update_interval": "2 minutes",
            "last_update": last_update,
            "message": "Giá cổ phiếu đang được cập nhật tự động mỗi 2 phút"
        }
    except Exception as e:
        return {
            "status": "unknown",
            "error": str(e)
        }


@app.get("/api/companies", response_model=List[Dict])
async def get_companies():
    """Lấy danh sách tất cả công ty"""
    df = db.get_all_companies()
    
    # Thêm các trường cần thiết cho Dashboard
    result = []
    for _, row in df.iterrows():
        company = row.to_dict()
        # Thêm price và change nếu chưa có
        if 'price' not in company or pd.isna(company.get('price')):
            company['price'] = company.get('current_price', 0)
        if 'change' not in company or pd.isna(company.get('change')):
            company['change'] = round(np.random.uniform(-5, 8), 2)  # Mock change
        # Đảm bảo có các trường cơ bản
        company['pe'] = company.get('pe_ratio', 0) or 0
        company['roe'] = company.get('roe', 0) or 0
        result.append(company)
    
    # Sắp xếp theo market_cap giảm dần
    result.sort(key=lambda x: x.get('market_cap', 0) or 0, reverse=True)
    
    return result


@app.get("/api/companies/search")
async def search_companies(q: str = Query(..., min_length=1, description="Search query")):
    """Tìm kiếm công ty theo mã CK hoặc tên"""
    df = db.get_all_companies()
    
    # Search by ticker or name
    query = q.upper().strip()
    mask = (
        df['ticker'].str.upper().str.contains(query, na=False) |
        df['name'].str.upper().str.contains(query, na=False)
    )
    
    results = df[mask].head(10)  # Limit to 10 results
    
    return {
        "query": q,
        "count": len(results),
        "results": results.fillna(0).to_dict(orient='records')
    }


@app.get("/api/companies/{ticker}")
async def get_company(ticker: str):
    """Lấy thông tin chi tiết công ty theo mã CK"""
    company = db.get_company_by_ticker(ticker.upper())
    if not company:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy công ty với mã {ticker}")
    return company


@app.get("/api/ticker-groups")
async def get_ticker_groups(limit: int = Query(4, ge=1, le=50)):
    """Lấy danh sách nhóm ticker từ ticker_type.json để hiển thị mã ngành."""
    groups = load_ticker_groups(limit)
    if not groups:
        raise HTTPException(status_code=404, detail="Khong tim thay du lieu ticker_type.json")
    return groups


@app.get("/api/companies/{ticker}/financials")
async def get_company_financials(ticker: str):
    """Lấy dữ liệu tài chính chi tiết của công ty"""
    financials = db.get_company_financials_detailed(ticker.upper())
    if not financials:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy dữ liệu tài chính cho mã {ticker}")
    return financials


@app.get("/api/financial-summary/{ticker}")
async def get_financial_summary(ticker: str):
    """
    Lấy tổng hợp dữ liệu tài chính 10 năm
    Bao gồm: Doanh thu, Lợi nhuận, EPS, BVPS, ROE, ROA, D/E, etc.
    """
    df = db.get_financial_summary(ticker.upper())
    if df.empty:
        raise HTTPException(status_code=404, detail=f"Không có dữ liệu tài chính cho mã {ticker}")
    
    # Convert to dict and handle NaN values
    result = df.fillna(0).to_dict(orient='records')
    return result


@app.get("/api/balance-sheet-structure/{ticker}")
async def get_balance_sheet_structure(ticker: str):
    """Lấy cơ cấu tài sản và nguồn vốn theo năm"""
    df = db.get_balance_sheet_structure(ticker.upper())
    if df.empty:
        raise HTTPException(status_code=404, detail=f"Không có dữ liệu cho mã {ticker}")
    return df.fillna(0).to_dict(orient='records')


@app.get("/api/cash-flow/{ticker}")
async def get_cash_flow(ticker: str):
    """Lấy dữ liệu dòng tiền theo năm"""
    df = db.get_cash_flow_data(ticker.upper())
    if df.empty:
        raise HTTPException(status_code=404, detail=f"Không có dữ liệu cho mã {ticker}")
    return df.fillna(0).to_dict(orient='records')


@app.post("/api/screener")
async def screen_stocks(filters: ScreenerFilters):
    """
    Bộ lọc cổ phiếu thông minh
    
    Ví dụ filters:
    - min_roe: ROE >= 15%
    - max_de: D/E <= 0.5
    - min_profit_growth: Tăng trưởng LN >= 10%
    - max_pe: P/E <= 15
    - consecutive_roe_years: ROE đạt ngưỡng trong 3 năm liên tiếp
    """
    filter_dict = filters.dict(exclude_none=True)
    df = db.screen_stocks(filter_dict)
    return df.fillna(0).to_dict(orient='records')


@app.get("/api/screener")
async def screen_stocks_get(
    min_roe: Optional[float] = None,
    max_de: Optional[float] = None,
    min_profit_growth: Optional[float] = None,
    max_pe: Optional[float] = None,
    min_pe: Optional[float] = None,
    max_pb: Optional[float] = None,
    min_dividend_yield: Optional[float] = None,
    consecutive_roe_years: Optional[int] = None,
    industry: Optional[str] = None
):
    """Screen stocks với GET parameters"""
    filters = {k: v for k, v in {
        'min_roe': min_roe,
        'max_de': max_de,
        'min_profit_growth': min_profit_growth,
        'max_pe': max_pe,
        'min_pe': min_pe,
        'max_pb': max_pb,
        'min_dividend_yield': min_dividend_yield,
        'consecutive_roe_years': consecutive_roe_years,
        'industry': industry
    }.items() if v is not None}
    
    df = db.screen_stocks(filters)
    return df.fillna(0).to_dict(orient='records')


@app.get("/api/industries")
async def get_industries():
    """Lấy danh sách ngành nghề"""
    df = db.get_all_companies()
    industries = df['industry'].dropna().unique().tolist()
    return sorted(industries)


@app.get("/api/market/overview")
async def get_market_overview():
    """Lấy tổng quan thị trường"""
    companies_df = db.get_all_companies()
    
    # Tính tổng vốn hóa
    total_market_cap = companies_df['market_cap'].sum()
    
    # Số lượng công ty
    total_companies = len(companies_df)
    
    # Vốn hóa trung bình
    avg_market_cap = companies_df['market_cap'].mean()
    
    # Giả định khối lượng giao dịch = 1% vốn hóa
    trading_volume = total_market_cap * 0.01 if not pd.isna(total_market_cap) else 0
    
    return {
        "totalMarketCap": int(total_market_cap) if not pd.isna(total_market_cap) else 0,
        "total_market_cap": int(total_market_cap) if not pd.isna(total_market_cap) else 0,
        "marketCapChange": 2.34,  # Mock - cần dữ liệu lịch sử để tính
        "tradingVolume": int(trading_volume),
        "volumeChange": 15.2,  # Mock
        "totalCompanies": total_companies,
        "total_companies": total_companies,
        "topGainersCount": int(total_companies * 0.4),  # Giả định 40% tăng
        "average_market_cap": int(avg_market_cap) if not pd.isna(avg_market_cap) else 0,
        "last_updated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
    }


@app.get("/api/market/status")
async def get_market_status():
    """Lấy trạng thái thị trường (mở/đóng cửa)"""
    from datetime import datetime, time
    
    now = datetime.now()
    current_time = now.time()
    weekday = now.weekday()  # 0=Monday, 6=Sunday
    
    # Vietnamese stock market hours: 9:00 - 11:30, 13:00 - 14:45 (Monday-Friday)
    morning_open = time(9, 0)
    morning_close = time(11, 30)
    afternoon_open = time(13, 0)
    afternoon_close = time(14, 45)
    
    is_weekday = weekday < 5  # Monday to Friday
    is_morning_session = morning_open <= current_time <= morning_close
    is_afternoon_session = afternoon_open <= current_time <= afternoon_close
    
    is_open = is_weekday and (is_morning_session or is_afternoon_session)
    
    if is_open:
        status = "open"
        message = "Thị trường đang mở cửa"
        next_event = "Đóng cửa" if is_morning_session else "Kết thúc phiên chiều"
        next_time = "11:30" if is_morning_session else "14:45"
    elif is_weekday:
        if current_time < morning_open:
            status = "pre-market"
            message = "Sắp mở cửa"
            next_event = "Mở cửa"
            next_time = "09:00"
        elif morning_close < current_time < afternoon_open:
            status = "lunch-break"
            message = "Nghỉ trưa"
            next_event = "Mở cửa phiên chiều"
            next_time = "13:00"
        else:
            status = "closed"
            message = "Thị trường đã đóng cửa"
            next_event = "Mở cửa"
            next_time = "09:00 (ngày mai)"
    else:
        status = "weekend"
        message = "Cuối tuần"
        next_event = "Mở cửa"
        next_time = "09:00 (Thứ 2)"
    
    return {
        "status": status,
        "is_open": is_open,
        "message": message,
        "next_event": next_event,
        "next_time": next_time,
        "current_time": now.strftime("%H:%M:%S"),
        "current_date": now.strftime("%Y-%m-%d")
    }


@app.get("/api/market/sectors")
async def get_sector_distribution():
    """Phân bố theo ngành"""
    companies_df = db.get_all_companies()
    
    # Group by industry
    sector_data = companies_df.groupby('industry').agg({
        'market_cap': 'sum',
        'ticker': 'count'
    }).reset_index()
    
    sector_data.columns = ['sector', 'market_cap', 'count']
    sector_data = sector_data.sort_values('market_cap', ascending=False)
    
    # Tính tỷ lệ phần trăm cho pie chart
    total_market_cap = sector_data['market_cap'].sum()
    result = []
    for _, row in sector_data.iterrows():
        name = row['sector'] if row['sector'] and not pd.isna(row['sector']) else 'Khác'
        value = (row['market_cap'] / total_market_cap * 100) if total_market_cap > 0 else 0
        result.append({
            'name': name,
            'value': round(value, 1),
            'market_cap': int(row['market_cap']) if not pd.isna(row['market_cap']) else 0,
            'count': int(row['count'])
        })
    
    return result


@app.get("/api/market/top-gainers")
async def get_top_gainers(limit: int = 10):
    """Top cổ phiếu tăng giá mạnh (mock data)"""
    # This would require price history data
    # For now, return companies sorted by market cap
    companies_df = db.get_all_companies()
    top = companies_df.nlargest(limit, 'market_cap')
    
    result = []
    for _, row in top.iterrows():
        result.append({
            "ticker": row['ticker'],
            "name": row['name'],
            "industry": row['industry'],
            "market_cap": int(row['market_cap']) if not pd.isna(row['market_cap']) else 0,
            "change_percent": round(np.random.uniform(1, 10), 2)  # Mock data
        })
    
    return result


@app.get("/api/market/top-losers")
async def get_top_losers(limit: int = 10):
    """Top cổ phiếu giảm giá mạnh (mock data)"""
    companies_df = db.get_all_companies()
    top = companies_df.nsmallest(limit, 'market_cap')
    
    result = []
    for _, row in top.iterrows():
        result.append({
            "ticker": row['ticker'],
            "name": row['name'],
            "industry": row['industry'],
            "market_cap": int(row['market_cap']) if not pd.isna(row['market_cap']) else 0,
            "change_percent": round(-np.random.uniform(1, 10), 2)  # Mock data
        })
    
    return result


@app.get("/api/screening/presets")
async def get_preset_filters():
    """Lấy các bộ lọc có sẵn"""
    return [
        {
            "id": "value",
            "name": "Value Investing",
            "description": "P/E thấp, ROE cao",
            "filters": {
                "max_pe": 15,
                "min_roe": 15,
                "max_de": 1
            }
        },
        {
            "id": "growth",
            "name": "Tăng trưởng",
            "description": "ROE cao, nợ thấp",
            "filters": {
                "min_roe": 20,
                "max_de": 1
            }
        },
        {
            "id": "dividend",
            "name": "Cổ tức cao",
            "description": "Dividend yield > 5%",
            "filters": {
                "min_dividend_yield": 5,
                "max_de": 1
            }
        },
        {
            "id": "quality",
            "name": "Chất lượng cao",
            "description": "ROE cao, nợ thấp, ổn định",
            "filters": {
                "min_roe": 20,
                "max_de": 0.5,
                "max_pe": 25
            }
        }
    ]


@app.get("/api/notifications")
async def get_notifications(unread_only: bool = False, limit: int = 20):
    """Lấy danh sách thông báo"""
    from datetime import datetime, timedelta
    
    # Mock notifications data
    notifications = [
        {
            "id": 1,
            "title": "Báo cáo tài chính mới",
            "message": "VNM vừa công bố BCTC Q4/2025 với EPS tăng 15%",
            "type": "success",
            "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
            "is_read": False,
            "ticker": "VNM"
        },
        {
            "id": 2,
            "title": "Canh bao thi truong",
            "message": "FPT đang giao dịch trên giá trị nội tại 20%",
            "type": "warning",
            "timestamp": (datetime.now() - timedelta(hours=5)).isoformat(),
            "is_read": False,
            "ticker": "FPT"
        },
        {
            "id": 3,
            "title": "Cơ hội đầu tư",
            "message": "HPG có ROE > 15% trong 5 năm liên tiếp",
            "type": "info",
            "timestamp": (datetime.now() - timedelta(days=1)).isoformat(),
            "is_read": True,
            "ticker": "HPG"
        },
        {
            "id": 4,
            "title": "Tin tức thị trường",
            "message": "VN-Index tăng 1.2% trong phiên hôm nay",
            "type": "info",
            "timestamp": (datetime.now() - timedelta(days=1, hours=3)).isoformat(),
            "is_read": True,
            "ticker": None
        },
        {
            "id": 5,
            "title": "Cổ tức",
            "message": "VCB chi trả cổ tức 2000đ/cp vào ngày 15/01",
            "type": "success",
            "timestamp": (datetime.now() - timedelta(days=2)).isoformat(),
            "is_read": True,
            "ticker": "VCB"
        }
    ]
    
    if unread_only:
        notifications = [n for n in notifications if not n['is_read']]
    
    return {
        "total": len(notifications),
        "unread": len([n for n in notifications if not n['is_read']]),
        "notifications": notifications[:limit]
    }


@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int):
    """Đánh dấu thông báo đã đọc"""
    # In real app, update database
    return {
        "success": True,
        "message": f"Đã đánh dấu thông báo {notification_id} là đã đọc"
    }


@app.delete("/api/notifications/{notification_id}")
async def delete_notification(notification_id: int):
    """Xóa thông báo"""
    # In real app, delete from database
    return {
        "success": True,
        "message": f"Đã xóa thông báo {notification_id}"
    }


# ============ Advanced Analysis APIs ============

@app.get("/api/analysis/{ticker}/ratios")
async def get_financial_ratios(ticker: str, year: Optional[int] = None):
    """
    Lấy tất cả chỉ số tài chính của một công ty
    Bao gồm: ROE, ROA, P/E, P/B, D/E, margins, growth rates, EPS, BVPS...
    """
    from backend.financial_analysis import calculate_financial_ratios
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from Database.models import Company, BalanceSheet, IncomeStatement, CashFlow
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        company = session.query(Company).filter(Company.ticker == ticker.upper()).first()
        if not company:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy mã {ticker}")
        
        # Get latest financial data
        balance_query = session.query(BalanceSheet).filter(
            BalanceSheet.company_id == company.id
        ).order_by(BalanceSheet.period_year.desc(), BalanceSheet.period_quarter.desc())
        
        income_query = session.query(IncomeStatement).filter(
            IncomeStatement.company_id == company.id
        ).order_by(IncomeStatement.period_year.desc(), IncomeStatement.period_quarter.desc())
        
        if year:
            balance_query = balance_query.filter(BalanceSheet.period_year == year)
            income_query = income_query.filter(IncomeStatement.period_year == year)
        
        balance_sheet = balance_query.first()
        income_statement = income_query.first()
        
        # Get previous period for growth calculation
        prev_income = session.query(IncomeStatement).filter(
            IncomeStatement.company_id == company.id,
            IncomeStatement.period_year == (balance_sheet.period_year - 1 if balance_sheet else 2024)
        ).first()
        
        prev_balance = session.query(BalanceSheet).filter(
            BalanceSheet.company_id == company.id,
            BalanceSheet.period_year == (balance_sheet.period_year - 1 if balance_sheet else 2024)
        ).first()
        
        ratios = calculate_financial_ratios(
            company, balance_sheet, income_statement, prev_income, prev_balance
        )
        
        return {
            "ticker": ticker.upper(),
            "company_name": company.name,
            "industry": company.industry,
            "period": {
                "year": balance_sheet.period_year if balance_sheet else None,
                "quarter": balance_sheet.period_quarter if balance_sheet else None
            },
            "ratios": ratios
        }
    finally:
        session.close()


@app.get("/api/analysis/{ticker}/f-score")
async def get_f_score(ticker: str):
    """
    Tính Piotroski F-Score (0-9) cho một công ty
    Đánh giá sức khỏe tài chính theo 9 tiêu chí
    """
    from backend.financial_analysis import calculate_piotroski_f_score
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from Database.models import Company, BalanceSheet, IncomeStatement, CashFlow
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        company = session.query(Company).filter(Company.ticker == ticker.upper()).first()
        if not company:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy mã {ticker}")
        
        # Get latest and previous year data
        balance_sheets = session.query(BalanceSheet).filter(
            BalanceSheet.company_id == company.id
        ).order_by(BalanceSheet.period_year.desc(), BalanceSheet.period_quarter.desc()).limit(2).all()
        
        income_statements = session.query(IncomeStatement).filter(
            IncomeStatement.company_id == company.id
        ).order_by(IncomeStatement.period_year.desc(), IncomeStatement.period_quarter.desc()).limit(2).all()
        
        cash_flows = session.query(CashFlow).filter(
            CashFlow.company_id == company.id
        ).order_by(CashFlow.period_year.desc(), CashFlow.period_quarter.desc()).limit(1).all()
        
        balance = balance_sheets[0] if balance_sheets else None
        prev_balance = balance_sheets[1] if len(balance_sheets) > 1 else None
        income = income_statements[0] if income_statements else None
        prev_income = income_statements[1] if len(income_statements) > 1 else None
        cash_flow = cash_flows[0] if cash_flows else None
        
        f_score = calculate_piotroski_f_score(
            balance, prev_balance, income, prev_income, cash_flow,
            company.shares_outstanding or 0
        )
        
        return {
            "ticker": ticker.upper(),
            "company_name": company.name,
            "f_score": f_score
        }
    finally:
        session.close()


@app.get("/api/analysis/{ticker}/health-score")
async def get_health_score(ticker: str):
    """
    Tính Health Score tổng hợp (0-100)
    Bao gồm F-Score, chi so thi truong, tang truong va warnings
    """
    from backend.financial_analysis import (
        calculate_financial_ratios, calculate_piotroski_f_score,
        detect_risk_warnings, calculate_health_score
    )
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from Database.models import Company, BalanceSheet, IncomeStatement, CashFlow
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        company = session.query(Company).filter(Company.ticker == ticker.upper()).first()
        if not company:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy mã {ticker}")
        
        # Get financial data
        balance_sheets = session.query(BalanceSheet).filter(
            BalanceSheet.company_id == company.id
        ).order_by(BalanceSheet.period_year.desc(), BalanceSheet.period_quarter.desc()).limit(2).all()
        
        income_statements = session.query(IncomeStatement).filter(
            IncomeStatement.company_id == company.id
        ).order_by(IncomeStatement.period_year.desc(), IncomeStatement.period_quarter.desc()).limit(4).all()
        
        cash_flows = session.query(CashFlow).filter(
            CashFlow.company_id == company.id
        ).order_by(CashFlow.period_year.desc(), CashFlow.period_quarter.desc()).limit(4).all()
        
        balance = balance_sheets[0] if balance_sheets else None
        prev_balance = balance_sheets[1] if len(balance_sheets) > 1 else None
        income = income_statements[0] if income_statements else None
        prev_income = income_statements[1] if len(income_statements) > 1 else None
        cash_flow = cash_flows[0] if cash_flows else None
        
        # Calculate ratios
        ratios = calculate_financial_ratios(company, balance, income, prev_income, prev_balance)
        
        # Calculate F-Score
        f_score_data = calculate_piotroski_f_score(
            balance, prev_balance, income, prev_income, cash_flow,
            company.shares_outstanding or 0
        )
        
        # Detect warnings
        warnings = detect_risk_warnings(income_statements, cash_flows, balance, ratios)
        
        # Calculate overall health score
        health = calculate_health_score(f_score_data['total_score'], ratios, warnings)
        
        return {
            "ticker": ticker.upper(),
            "company_name": company.name,
            "industry": company.industry,
            "health_score": health,
            "f_score": f_score_data,
            "key_ratios": {
                "roe": ratios.get('roe'),
                "roa": ratios.get('roa'),
                "pe_ratio": ratios.get('pe_ratio'),
                "pb_ratio": ratios.get('pb_ratio'),
                "debt_to_equity": ratios.get('debt_to_equity'),
                "current_ratio": ratios.get('current_ratio'),
                "gross_margin": ratios.get('gross_margin'),
                "revenue_growth": ratios.get('revenue_growth'),
                "profit_growth": ratios.get('profit_growth')
            },
            "warnings": warnings,
            "price_info": {
                "current_price": company.current_price,
                "market_cap": company.market_cap,
                "shares_outstanding": company.shares_outstanding
            }
        }
    finally:
        session.close()


@app.get("/api/analysis/{ticker}/warnings")
async def get_risk_warnings(ticker: str):
    """Lấy danh sách cảnh báo rủi ro của công ty"""
    from backend.financial_analysis import calculate_financial_ratios, detect_risk_warnings
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from Database.models import Company, BalanceSheet, IncomeStatement, CashFlow
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        company = session.query(Company).filter(Company.ticker == ticker.upper()).first()
        if not company:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy mã {ticker}")
        
        # Get data
        balance = session.query(BalanceSheet).filter(
            BalanceSheet.company_id == company.id
        ).order_by(BalanceSheet.period_year.desc(), BalanceSheet.period_quarter.desc()).first()
        
        income_statements = session.query(IncomeStatement).filter(
            IncomeStatement.company_id == company.id
        ).order_by(IncomeStatement.period_year.desc(), IncomeStatement.period_quarter.desc()).limit(4).all()
        
        cash_flows = session.query(CashFlow).filter(
            CashFlow.company_id == company.id
        ).order_by(CashFlow.period_year.desc(), CashFlow.period_quarter.desc()).limit(4).all()
        
        income = income_statements[0] if income_statements else None
        prev_income = income_statements[1] if len(income_statements) > 1 else None
        
        ratios = calculate_financial_ratios(company, balance, income, prev_income, None)
        warnings = detect_risk_warnings(income_statements, cash_flows, balance, ratios)
        
        return {
            "ticker": ticker.upper(),
            "company_name": company.name,
            "total_warnings": len(warnings),
            "critical": len([w for w in warnings if w['level'] == 'critical']),
            "warning": len([w for w in warnings if w['level'] == 'warning']),
            "info": len([w for w in warnings if w['level'] == 'info']),
            "warnings": warnings
        }
    finally:
        session.close()


class CompareRequest(BaseModel):
    tickers: List[str]


@app.post("/api/compare")
async def compare_companies(request: CompareRequest):
    """
    So sánh 2-5 công ty theo các chỉ số tài chính
    Body: {"tickers": ["VNM", "FPT", "VIC"]}
    """
    tickers = request.tickers
    
    if len(tickers) < 2:
        raise HTTPException(status_code=400, detail="Cần ít nhất 2 mã để so sánh")
    if len(tickers) > 5:
        raise HTTPException(status_code=400, detail="Tối đa 5 mã")
    
    from backend.financial_analysis import calculate_financial_ratios, calculate_piotroski_f_score
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from Database.models import Company, BalanceSheet, IncomeStatement, CashFlow
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        results = []
        
        for ticker in tickers:
            company = session.query(Company).filter(Company.ticker == ticker.upper()).first()
            if not company:
                continue
            
            balance = session.query(BalanceSheet).filter(
                BalanceSheet.company_id == company.id
            ).order_by(BalanceSheet.period_year.desc(), BalanceSheet.period_quarter.desc()).first()
            
            income_list = session.query(IncomeStatement).filter(
                IncomeStatement.company_id == company.id
            ).order_by(IncomeStatement.period_year.desc(), IncomeStatement.period_quarter.desc()).limit(2).all()
            
            cash_flow = session.query(CashFlow).filter(
                CashFlow.company_id == company.id
            ).order_by(CashFlow.period_year.desc(), CashFlow.period_quarter.desc()).first()
            
            income = income_list[0] if income_list else None
            prev_income = income_list[1] if len(income_list) > 1 else None
            
            ratios = calculate_financial_ratios(company, balance, income, prev_income, None)
            
            # Get F-Score
            prev_balance = session.query(BalanceSheet).filter(
                BalanceSheet.company_id == company.id,
                BalanceSheet.period_year == (balance.period_year - 1 if balance else 2024)
            ).first()
            
            f_score = calculate_piotroski_f_score(
                balance, prev_balance, income, prev_income, cash_flow,
                company.shares_outstanding or 0
            )
            
            results.append({
                "ticker": ticker.upper(),
                "name": company.name,
                "industry": company.industry,
                "price": company.current_price,
                "market_cap": company.market_cap,
                "f_score": f_score['total_score'],
                "ratios": {
                    "roe": ratios.get('roe'),
                    "roa": ratios.get('roa'),
                    "pe_ratio": ratios.get('pe_ratio'),
                    "pb_ratio": ratios.get('pb_ratio'),
                    "debt_to_equity": ratios.get('debt_to_equity'),
                    "current_ratio": ratios.get('current_ratio'),
                    "gross_margin": ratios.get('gross_margin'),
                    "net_margin": ratios.get('net_margin'),
                    "revenue_growth": ratios.get('revenue_growth'),
                    "profit_growth": ratios.get('profit_growth'),
                    "eps": ratios.get('eps'),
                    "bvps": ratios.get('bvps'),
                    "dividend_yield": ratios.get('dividend_yield')
                }
            })
        
        return {
            "companies": results,
            "count": len(results),
            "comparison_metrics": [
                "roe", "roa", "pe_ratio", "pb_ratio", "debt_to_equity",
                "gross_margin", "net_margin", "revenue_growth", "profit_growth",
                "f_score", "eps", "bvps"
            ]
        }
    finally:
        session.close()


@app.get("/api/compare")
async def compare_companies_get(tickers: str):
    """So sánh công ty (GET method) - tickers ngăn cách bằng dấu phẩy"""
    ticker_list = [t.strip().upper() for t in tickers.split(',')]
    # Create CompareRequest object for the POST handler
    request = CompareRequest(tickers=ticker_list)
    return await compare_companies(request)


@app.get("/api/export/{ticker}")
async def export_company_data(ticker: str, format: str = "json"):
    """
    Xuất dữ liệu tài chính công ty
    Format: json, csv
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from Database.models import Company, BalanceSheet, IncomeStatement, CashFlow
    from fastapi.responses import Response
    import csv
    import io
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        company = session.query(Company).filter(Company.ticker == ticker.upper()).first()
        if not company:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy mã {ticker}")
        
        # Get all financial data
        balance_sheets = session.query(BalanceSheet).filter(
            BalanceSheet.company_id == company.id
        ).order_by(BalanceSheet.period_year.desc(), BalanceSheet.period_quarter.desc()).all()
        
        income_statements = session.query(IncomeStatement).filter(
            IncomeStatement.company_id == company.id
        ).order_by(IncomeStatement.period_year.desc(), IncomeStatement.period_quarter.desc()).all()
        
        cash_flows = session.query(CashFlow).filter(
            CashFlow.company_id == company.id
        ).order_by(CashFlow.period_year.desc(), CashFlow.period_quarter.desc()).all()
        
        if format.lower() == "csv":
            # Create CSV
            output = io.StringIO()
            
            # Company info
            output.write(f"# {company.ticker} - {company.name}\n")
            output.write(f"# Industry: {company.industry}\n")
            output.write(f"# Export Date: {pd.Timestamp.now().strftime('%Y-%m-%d')}\n\n")
            
            # Income Statement
            output.write("=== INCOME STATEMENT ===\n")
            output.write("Year,Quarter,Revenue,Gross Profit,Operating Income,Net Profit\n")
            for is_ in income_statements:
                output.write(f"{is_.period_year},{is_.period_quarter or 'Annual'},{is_.revenue or 0},{is_.gross_profit or 0},{is_.operating_income or 0},{is_.net_profit or 0}\n")
            
            output.write("\n=== BALANCE SHEET ===\n")
            output.write("Year,Quarter,Total Assets,Total Liabilities,Total Equity,Cash,Inventories\n")
            for bs in balance_sheets:
                output.write(f"{bs.period_year},{bs.period_quarter or 'Annual'},{bs.total_assets or 0},{bs.total_liabilities or 0},{bs.total_equity or 0},{bs.cash_and_equivalents or 0},{bs.inventories or 0}\n")
            
            output.write("\n=== CASH FLOW ===\n")
            output.write("Year,Quarter,Operating CF,Investing CF,Financing CF,Net Change\n")
            for cf in cash_flows:
                output.write(f"{cf.period_year},{cf.period_quarter or 'Annual'},{cf.operating_cash_flow or 0},{cf.investing_cash_flow or 0},{cf.financing_cash_flow or 0},{cf.net_change_in_cash or 0}\n")
            
            return Response(
                content=output.getvalue(),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={ticker}_financial_data.csv"}
            )
        
        # JSON format
        return {
            "company": {
                "ticker": company.ticker,
                "name": company.name,
                "industry": company.industry,
                "current_price": company.current_price,
                "market_cap": company.market_cap,
                "shares_outstanding": company.shares_outstanding
            },
            "income_statements": [
                {
                    "year": is_.period_year,
                    "quarter": is_.period_quarter,
                    "revenue": is_.revenue,
                    "gross_profit": is_.gross_profit,
                    "operating_income": is_.operating_income,
                    "net_profit": is_.net_profit
                }
                for is_ in income_statements
            ],
            "balance_sheets": [
                {
                    "year": bs.period_year,
                    "quarter": bs.period_quarter,
                    "total_assets": bs.total_assets,
                    "total_liabilities": bs.total_liabilities,
                    "total_equity": bs.total_equity,
                    "cash_and_equivalents": bs.cash_and_equivalents,
                    "inventories": bs.inventories,
                    "current_assets": bs.current_assets,
                    "current_liabilities": bs.current_liabilities
                }
                for bs in balance_sheets
            ],
            "cash_flows": [
                {
                    "year": cf.period_year,
                    "quarter": cf.period_quarter,
                    "operating_cash_flow": cf.operating_cash_flow,
                    "investing_cash_flow": cf.investing_cash_flow,
                    "financing_cash_flow": cf.financing_cash_flow,
                    "net_change_in_cash": cf.net_change_in_cash,
                    "capex": cf.capex
                }
                for cf in cash_flows
            ],
            "export_date": pd.Timestamp.now().isoformat()
        }
    finally:
        session.close()


@app.get("/api/screener/advanced")
async def advanced_screener(
    # Market ratio filters
    min_pe: Optional[float] = None,
    max_pe: Optional[float] = None,
    min_pb: Optional[float] = None,
    max_pb: Optional[float] = None,
    
    # Profitability filters
    min_roe: Optional[float] = None,
    max_roe: Optional[float] = None,
    min_roa: Optional[float] = None,
    min_gross_margin: Optional[float] = None,
    min_net_margin: Optional[float] = None,
    
    # Financial health
    max_de: Optional[float] = None,
    min_current_ratio: Optional[float] = None,
    
    # Growth
    min_revenue_growth: Optional[float] = None,
    min_profit_growth: Optional[float] = None,
    
    # F-Score
    min_f_score: Optional[int] = None,
    
    # Industry
    industry: Optional[str] = None,
    
    # Sorting
    sort_by: str = "market_cap",
    sort_order: str = "desc",
    limit: int = 50
):
    """
    Bộ lọc nâng cao với đầy đủ tiêu chí
    """
    from backend.financial_analysis import calculate_financial_ratios, calculate_piotroski_f_score
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from Database.models import Company, BalanceSheet, IncomeStatement, CashFlow
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Get all companies
        companies = session.query(Company).all()
        
        if industry:
            companies = [c for c in companies if c.industry and industry.lower() in c.industry.lower()]
        
        results = []
        
        for company in companies:
            # Get financial data
            balance = session.query(BalanceSheet).filter(
                BalanceSheet.company_id == company.id
            ).order_by(BalanceSheet.period_year.desc(), BalanceSheet.period_quarter.desc()).first()
            
            income_list = session.query(IncomeStatement).filter(
                IncomeStatement.company_id == company.id
            ).order_by(IncomeStatement.period_year.desc(), IncomeStatement.period_quarter.desc()).limit(2).all()
            
            cash_flow = session.query(CashFlow).filter(
                CashFlow.company_id == company.id
            ).order_by(CashFlow.period_year.desc(), CashFlow.period_quarter.desc()).first()
            
            income = income_list[0] if income_list else None
            prev_income = income_list[1] if len(income_list) > 1 else None
            
            # Calculate ratios
            ratios = calculate_financial_ratios(company, balance, income, prev_income, None)
            
            # Apply filters
            passed = True
            
            # P/E filter
            pe = ratios.get('pe_ratio')
            if min_pe is not None and (pe is None or pe < min_pe):
                passed = False
            if max_pe is not None and (pe is None or pe > max_pe):
                passed = False
            
            # P/B filter
            pb = ratios.get('pb_ratio')
            if min_pb is not None and (pb is None or pb < min_pb):
                passed = False
            if max_pb is not None and (pb is None or pb > max_pb):
                passed = False
            
            # ROE filter
            roe = ratios.get('roe')
            if min_roe is not None and (roe is None or roe < min_roe):
                passed = False
            if max_roe is not None and (roe is None or roe > max_roe):
                passed = False
            
            # ROA filter
            roa = ratios.get('roa')
            if min_roa is not None and (roa is None or roa < min_roa):
                passed = False
            
            # Margin filters
            gm = ratios.get('gross_margin')
            nm = ratios.get('net_margin')
            if min_gross_margin is not None and (gm is None or gm < min_gross_margin):
                passed = False
            if min_net_margin is not None and (nm is None or nm < min_net_margin):
                passed = False
            
            # D/E filter
            de = ratios.get('debt_to_equity')
            if max_de is not None and (de is None or de > max_de):
                passed = False
            
            # Current ratio filter
            cr = ratios.get('current_ratio')
            if min_current_ratio is not None and (cr is None or cr < min_current_ratio):
                passed = False
            
            # Growth filters
            rg = ratios.get('revenue_growth')
            pg = ratios.get('profit_growth')
            if min_revenue_growth is not None and (rg is None or rg < min_revenue_growth):
                passed = False
            if min_profit_growth is not None and (pg is None or pg < min_profit_growth):
                passed = False
            
            # F-Score filter
            if min_f_score is not None:
                prev_balance = session.query(BalanceSheet).filter(
                    BalanceSheet.company_id == company.id,
                    BalanceSheet.period_year == (balance.period_year - 1 if balance else 2024)
                ).first()
                
                f_score_data = calculate_piotroski_f_score(
                    balance, prev_balance, income, prev_income, cash_flow,
                    company.shares_outstanding or 0
                )
                f_score = f_score_data['total_score']
                
                if f_score < min_f_score:
                    passed = False
            else:
                f_score = None
            
            if passed:
                results.append({
                    "ticker": company.ticker,
                    "name": company.name,
                    "industry": company.industry,
                    "price": company.current_price,
                    "market_cap": company.market_cap,
                    "f_score": f_score,
                    "pe_ratio": ratios.get('pe_ratio'),
                    "pb_ratio": ratios.get('pb_ratio'),
                    "roe": ratios.get('roe'),
                    "roa": ratios.get('roa'),
                    "gross_margin": ratios.get('gross_margin'),
                    "net_margin": ratios.get('net_margin'),
                    "debt_to_equity": ratios.get('debt_to_equity'),
                    "current_ratio": ratios.get('current_ratio'),
                    "revenue_growth": ratios.get('revenue_growth'),
                    "profit_growth": ratios.get('profit_growth'),
                    "eps": ratios.get('eps'),
                    "bvps": ratios.get('bvps')
                })
        
        # Sort results
        if results:
            reverse = sort_order.lower() == 'desc'
            results.sort(
                key=lambda x: x.get(sort_by) if x.get(sort_by) is not None else (float('-inf') if reverse else float('inf')),
                reverse=reverse
            )
        
        return {
            "total": len(results),
            "limit": limit,
            "filters_applied": {
                "min_pe": min_pe, "max_pe": max_pe,
                "min_pb": min_pb, "max_pb": max_pb,
                "min_roe": min_roe, "max_roe": max_roe,
                "min_roa": min_roa,
                "min_gross_margin": min_gross_margin,
                "min_net_margin": min_net_margin,
                "max_de": max_de,
                "min_current_ratio": min_current_ratio,
                "min_revenue_growth": min_revenue_growth,
                "min_profit_growth": min_profit_growth,
                "min_f_score": min_f_score,
                "industry": industry
            },
            "results": results[:limit]
        }
    finally:
        session.close()


@app.get("/api/companies/{ticker}/balance-sheets")
async def get_company_balance_sheets(ticker: str):
    """Lấy danh sách các báo cáo cân đối kế toán của công ty"""
    return db.get_company_balance_sheets_mapped(ticker.upper())


@app.get("/api/companies/{ticker}/income-statements")
async def get_company_income_statements(ticker: str):
    """Lấy danh sách các báo cáo kết quả kinh doanh của công ty"""
    return db.get_company_income_statements_mapped(ticker.upper())


@app.get("/api/companies/{ticker}/cash-flows")
async def get_company_cash_flows(ticker: str):
    """Lấy danh sách các báo cáo lưu chuyển tiền tệ của công ty"""
    return db.get_company_cash_flows_mapped(ticker.upper())


@app.post("/api/update-prices")
async def trigger_price_update():
    """Trigger cập nhật giá cổ phiếu (admin only)"""
    import subprocess
    
    try:
        # Run the update script
        result = subprocess.run(
            ["python", "update_stock_prices.py"],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        return {
            "success": result.returncode == 0,
            "message": "Price update completed" if result.returncode == 0 else "Update failed",
            "output": result.stdout[-1000:] if result.stdout else None,
            "errors": result.stderr[-500:] if result.stderr else None
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "message": "Update timeout (>120s)"}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ============ Run Server ============

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True
    )
