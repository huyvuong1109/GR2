"""
FastAPI Backend - REST API for Financial Analysis App
"""
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
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
from backend.fastapi_auth.app.db import Base as UserBase
from backend.fastapi_auth.app.db import SessionLocal as UserSessionLocal
from backend.fastapi_auth.app.db import engine as user_engine
from backend.fastapi_auth.app.auth import decode_token
from backend.fastapi_auth.app import crud as user_crud
from backend.fastapi_auth.app.routes.auth_router import router as auth_router
from backend.fastapi_auth.app.routes.user_router import router as user_router
from backend.fastapi_auth.app.routes.watchlist_router import router as watchlist_router
from backend.fastapi_auth.app.routes.notifications_router import router as notifications_router
from backend.fastapi_auth.app.routes.value_router import router as value_router
from backend.fastapi_auth.app.routes.saved_filter_router import router as saved_filter_router
from backend.fastapi_auth.app.routes.market_router import _fetch_index, _market_session
from backend.fastapi_auth.app.ws import manager as notification_manager
from backend.fastapi_auth.app.ws import serialize_notification

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
                timeout=240,
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
                match = re.search(r'(\d+)/(\d+)', output)
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
            print("⚠️ [Background] Cập nhật giá quá thời gian (4 phút), bỏ qua...")
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

# User/auth database and routers live in backend.fastapi_auth, but the app should run
# from one ASGI entrypoint so auth and market data stay on the same localhost port.
UserBase.metadata.create_all(bind=user_engine)
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(watchlist_router)
app.include_router(notifications_router)
app.include_router(value_router)
app.include_router(saved_filter_router)


@app.websocket("/ws/notifications")
async def notifications_ws(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        await websocket.close(code=1008)
        return

    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        await websocket.close(code=1008)
        return

    user_db = UserSessionLocal()
    try:
        user = user_crud.get_user(user_db, user_id)
        if not user:
            await websocket.close(code=1008)
            return

        await notification_manager.connect(user_id, websocket)
        notifications = user_crud.list_notifications(user_db, user_id=user_id, unread_only=False)
        await websocket.send_json(
            {
                "type": "init",
                "notifications": [serialize_notification(n) for n in notifications],
            }
        )

        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        notification_manager.disconnect(user_id, websocket)
        user_db.close()


# ============ Pydantic Models ============

class CompanyResponse(BaseModel):
    id: int
    ticker: str
    name: str
    description: Optional[str] = None
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
        # Thêm price nếu chưa có
        if 'price' not in company or pd.isna(company.get('price')):
            company['price'] = company.get('current_price', None)
        company['change'] = company.get('change') if not pd.isna(company.get('change')) else None
        # Đảm bảo có các trường cơ bản
        company['pe'] = company.get('pe_ratio', 0) or 0
        company['roe'] = company.get('roe', 0) or 0
        result.append(company)
    
    # Sắp xếp theo market_cap giảm dần
    result.sort(key=lambda x: x.get('market_cap', 0) or 0, reverse=True)
    
    return result


@app.get("/api/companies/batch")
async def get_companies_batch(tickers: str = Query(..., description="Comma-separated tickers")):
    symbols = [t.strip().upper() for t in tickers.split(',') if t.strip()]
    df = db.get_companies_by_tickers(symbols)
    if df.empty:
        return []
    return df.where(pd.notnull(df), None).to_dict(orient='records')


@app.get("/api/price-history")
async def get_price_history(tickers: str = Query(..., description="Comma-separated tickers"), limit: int = Query(7, ge=1, le=30)):
    symbols = [t.strip().upper() for t in tickers.split(',') if t.strip()]
    payload = {}
    for symbol in symbols:
        df = db.get_price_history(symbol, limit)
        if df.empty:
            payload[symbol] = []
            continue
        rows = df.where(pd.notnull(df), None).to_dict(orient='records')
        rows = list(reversed(rows))
        payload[symbol] = rows
    return payload


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
    """Lay tong quan thi truong tu du lieu chi so thuc."""
    session = _market_session()
    vnindex = _fetch_index("VNINDEX")

    return {
        **session,
        "market_status": session["status"],
        "market_status_message": session["message"],
        "vn_index": vnindex.get("value") if vnindex else None,
        "vn_index_change": vnindex.get("change") if vnindex else None,
        "vn_index_change_percent": vnindex.get("change_percent") if vnindex else None,
        "vn_index_trading_date": vnindex.get("trading_date") if vnindex else None,
        "data_source": vnindex.get("source") if vnindex else None,
    }


@app.get("/api/market/status")
async def get_market_status():
    """Lay trang thai thi truong va VN-Index."""
    session = _market_session()
    vnindex = _fetch_index("VNINDEX")

    return {
        **session,
        "vn_index": vnindex.get("value") if vnindex else None,
        "vn_index_change": vnindex.get("change") if vnindex else None,
        "vn_index_change_percent": vnindex.get("change_percent") if vnindex else None,
        "vn_index_trading_date": vnindex.get("trading_date") if vnindex else None,
        "data_source": vnindex.get("source") if vnindex else None,
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
    df = db.get_top_movers(limit, direction="gainers")
    return df.where(pd.notnull(df), None).to_dict(orient='records')


@app.get("/api/market/top-losers")
async def get_top_losers(limit: int = 10):
    """Top cổ phiếu giảm giá mạnh (mock data)"""
    df = db.get_top_movers(limit, direction="losers")
    return df.where(pd.notnull(df), None).to_dict(orient='records')


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
    return {
        "total": 0,
        "unread": 0,
        "notifications": []
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
            "company_type": company.company_type,
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
            "company_type": company.company_type,
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
                "net_margin": ratios.get('net_margin'),
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


# ============ Value Investing APIs ============

def _trend_label(values: list[float], threshold: float = 0.08) -> str:
    if len(values) < 2:
        return "flat"
    first = values[0]
    last = values[-1]
    if first in (None, 0) or pd.isna(first) or pd.isna(last):
        return "flat"
    change = (last - first) / abs(first)
    if change > threshold:
        return "increasing"
    if change < -threshold:
        return "decreasing"
    return "flat"


def _consistency_label(growth_series: list[float], threshold: float = 7.5) -> str:
    values = [v for v in growth_series if v is not None and not pd.isna(v)]
    if len(values) < 3:
        return "insufficient"
    return "consistent" if float(np.std(values)) <= threshold else "volatile"


def _compute_intrinsic_value(fcf: float, growth_rate: float, discount_rate: float, years: int) -> float | None:
    if fcf is None or fcf <= 0 or discount_rate <= 0 or years <= 0:
        return None
    growth = growth_rate / 100
    discount = discount_rate / 100
    intrinsic = 0.0
    for year in range(1, years + 1):
        projected = fcf * ((1 + growth) ** year)
        intrinsic += projected / ((1 + discount) ** year)
    return intrinsic


@app.get("/api/value/companies/{ticker}/analysis")
async def value_analysis(ticker: str, years: int = Query(10, ge=5, le=15)):
    df = db.get_long_term_metrics(ticker.upper(), years)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"Không có dữ liệu dài hạn cho mã {ticker}")

    revenue_trend = _trend_label(df["revenue"].tolist())
    profit_trend = _trend_label(df["net_profit"].tolist())
    revenue_consistency = _consistency_label(df["revenue_growth"].tolist())
    profit_consistency = _consistency_label(df["profit_growth"].tolist())

    latest = df.iloc[-1]
    debt_to_equity = None
    if latest.get("total_equity") and latest.get("total_equity") != 0:
        debt_to_equity = latest.get("total_liabilities") / latest.get("total_equity")

    summary = []
    if revenue_consistency == "consistent" and profit_consistency == "consistent":
        summary.append("Consistent growth over 5 years")
    if profit_trend == "decreasing":
        summary.append("Declining profitability")
    if debt_to_equity and debt_to_equity > 1.5:
        summary.append("High debt relative to equity")
    if revenue_trend == "flat" and profit_trend == "flat":
        summary.append("Flat growth trend")

    return {
        "ticker": ticker.upper(),
        "time_series": df.where(pd.notnull(df), None).to_dict(orient="records"),
        "summary": summary,
        "trends": {
            "revenue": revenue_trend,
            "profit": profit_trend,
        },
        "consistency": {
            "revenue_growth": revenue_consistency,
            "profit_growth": profit_consistency,
        },
    }


class IntrinsicValueRequest(BaseModel):
    growth_rate: float
    discount_rate: float
    years: int = 5


@app.post("/api/value/companies/{ticker}/intrinsic-value")
async def intrinsic_value(ticker: str, payload: IntrinsicValueRequest):
    df = db.get_long_term_metrics(ticker.upper(), max(payload.years, 5))
    if df.empty:
        raise HTTPException(status_code=404, detail=f"Không có dữ liệu dài hạn cho mã {ticker}")

    latest = df.iloc[-1]
    fcf = latest.get("free_cash_flow")
    intrinsic_total = _compute_intrinsic_value(fcf, payload.growth_rate, payload.discount_rate, payload.years)
    shares = latest.get("shares_outstanding")
    intrinsic_per_share = None
    if intrinsic_total is not None and shares and shares > 0:
        intrinsic_per_share = intrinsic_total / shares

    return {
        "ticker": ticker.upper(),
        "intrinsic_value": intrinsic_per_share,
        "assumptions": {
            "growth_rate": payload.growth_rate,
            "discount_rate": payload.discount_rate,
            "years": payload.years,
            "base_free_cash_flow": fcf,
        },
    }


@app.get("/api/value/companies/{ticker}/margin-of-safety")
async def margin_of_safety(
    ticker: str,
    growth_rate: float = Query(8.0),
    discount_rate: float = Query(12.0),
    years: int = Query(5, ge=3, le=10),
):
    df = db.get_long_term_metrics(ticker.upper(), max(years, 5))
    if df.empty:
        raise HTTPException(status_code=404, detail=f"Không có dữ liệu dài hạn cho mã {ticker}")

    latest = df.iloc[-1]
    fcf = latest.get("free_cash_flow")
    intrinsic_total = _compute_intrinsic_value(fcf, growth_rate, discount_rate, years)
    shares = latest.get("shares_outstanding")
    intrinsic_per_share = None
    if intrinsic_total is not None and shares and shares > 0:
        intrinsic_per_share = intrinsic_total / shares

    market_price = latest.get("current_price")
    margin = None
    label = None
    if intrinsic_per_share and market_price:
        margin = (intrinsic_per_share - market_price) / intrinsic_per_share
        if margin > 0.15:
            label = "Undervalued"
        elif margin < -0.15:
            label = "Overvalued"
        else:
            label = "Fairly valued"

    return {
        "ticker": ticker.upper(),
        "market_price": market_price,
        "intrinsic_value": intrinsic_per_share,
        "margin_of_safety": margin,
        "label": label,
        "assumptions": {
            "growth_rate": growth_rate,
            "discount_rate": discount_rate,
            "years": years,
        },
    }


@app.get("/api/value/companies/{ticker}/insights")
async def investment_insights(ticker: str):
    df = db.get_long_term_metrics(ticker.upper(), 10)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"Không có dữ liệu dài hạn cho mã {ticker}")

    insights = []
    if (df["roe"].tail(5) >= 20).all():
        insights.append("Company has maintained ROE above 20% for 5 years")

    revenue_growth = df["revenue_growth"].dropna().tail(3).tolist()
    if len(revenue_growth) == 3 and revenue_growth[2] < revenue_growth[0]:
        insights.append("Revenue growth is slowing down")

    debt_series = df["debt"].dropna().tolist()
    if _trend_label(debt_series) == "increasing":
        insights.append("Debt level is increasing significantly")

    if not insights:
        insights.append("No major long-term red flags detected")

    return {
        "ticker": ticker.upper(),
        "insights": insights,
    }


@app.get("/api/value/companies/{ticker}/health-score")
async def value_health_score(ticker: str):
    df = db.get_long_term_metrics(ticker.upper(), 10)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"Không có dữ liệu dài hạn cho mã {ticker}")

    latest = df.iloc[-1]
    roe = latest.get("roe") or 0
    revenue_growth = latest.get("revenue_growth") or 0
    profit_growth = latest.get("profit_growth") or 0
    debt_to_equity = None
    if latest.get("total_equity") and latest.get("total_equity") != 0:
        debt_to_equity = latest.get("total_liabilities") / latest.get("total_equity")
    fcf = latest.get("free_cash_flow") or 0

    profitability = min(10, max(0, roe / 2))
    growth = min(10, max(0, (revenue_growth + profit_growth) / 4))
    debt_score = 10 if debt_to_equity is None else max(0, 10 - (debt_to_equity * 4))
    efficiency = 10 if fcf > 0 else 4

    overall = round((profitability + growth + debt_score + efficiency) / 4, 2)

    return {
        "ticker": ticker.upper(),
        "overall": overall,
        "breakdown": {
            "profitability": round(profitability, 2),
            "growth": round(growth, 2),
            "debt": round(debt_score, 2),
            "efficiency": round(efficiency, 2),
        },
    }


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
    
    from backend.financial_analysis import (
        calculate_financial_ratios,
        calculate_piotroski_f_score,
        calculate_health_score,
        detect_risk_warnings,
    )
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
                "company_type": company.company_type,
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


@app.get("/api/screener/periods")
async def get_screener_periods():
    """Return periods that have both income statement and balance sheet data."""
    from sqlalchemy import create_engine, func
    from sqlalchemy.orm import sessionmaker
    from Database.models import BalanceSheet, IncomeStatement

    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        rows = session.query(
            IncomeStatement.period_year,
            IncomeStatement.period_quarter,
            IncomeStatement.period_type,
            func.count(IncomeStatement.company_id.distinct()).label("company_count"),
        ).join(
            BalanceSheet,
            (IncomeStatement.company_id == BalanceSheet.company_id) &
            (IncomeStatement.period_year == BalanceSheet.period_year) &
            (IncomeStatement.period_type == BalanceSheet.period_type) &
            (func.coalesce(IncomeStatement.period_quarter, 0) == func.coalesce(BalanceSheet.period_quarter, 0)),
        ).group_by(
            IncomeStatement.period_year,
            IncomeStatement.period_quarter,
            IncomeStatement.period_type,
        ).order_by(
            IncomeStatement.period_year.desc(),
            IncomeStatement.period_quarter.desc(),
        ).all()

        periods = [
            {
                "year": row.period_year,
                "quarter": row.period_quarter,
                "period_type": row.period_type,
                "label": f"Q{row.period_quarter}/{row.period_year}" if row.period_quarter else f"{row.period_year}",
                "company_count": row.company_count,
            }
            for row in rows
            if row.period_year
        ]

        return {"periods": periods}
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

    # Reporting period. Empty means latest available data.
    period_year: Optional[int] = None,
    period_quarter: Optional[int] = None,
    
    # Sorting
    sort_by: str = "market_cap",
    sort_order: str = "desc",
    limit: int = 50
):
    """
    Bộ lọc nâng cao với đầy đủ tiêu chí
    """
    from backend.financial_analysis import (
        calculate_financial_ratios,
        calculate_piotroski_f_score,
        calculate_health_score,
        detect_risk_warnings,
    )
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    from Database.models import Company, BalanceSheet, IncomeStatement, CashFlow
    import copy
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        def selected_period_end_date():
            if not period_year:
                return None

            if period_quarter and period_quarter > 0:
                quarter_end = {
                    1: "03-31",
                    2: "06-30",
                    3: "09-30",
                    4: "12-31",
                }.get(period_quarter, "12-31")
                return f"{period_year}-{quarter_end}"

            return f"{period_year}-12-31"

        period_end_date = selected_period_end_date()

        def get_price_at_or_before(ticker: str, end_date: Optional[str]):
            if not end_date:
                return None, None

            row = session.execute(
                text(
                    """
                    SELECT close_price, trade_date
                    FROM price_history
                    WHERE UPPER(ticker) = :ticker
                      AND trade_date <= :end_date
                    ORDER BY trade_date DESC, id DESC
                    LIMIT 1
                    """
                ),
                {"ticker": ticker.upper(), "end_date": end_date},
            ).first()

            if not row:
                return None, None

            return row.close_price, row.trade_date

        # Get all companies
        companies = session.query(Company).all()
        
        if industry:
            companies = [c for c in companies if c.industry and industry.lower() in c.industry.lower()]
        
        results = []
        
        for company in companies:
            def latest_query(model):
                return session.query(model).filter(model.company_id == company.id).order_by(
                    model.period_year.desc(),
                    model.period_quarter.desc(),
                )

            def period_query(model):
                query = session.query(model).filter(model.company_id == company.id)
                if not period_year:
                    return query.order_by(model.period_year.desc(), model.period_quarter.desc()).first()

                if period_quarter and period_quarter > 0:
                    return query.filter(
                        model.period_type == 'quarterly',
                        model.period_year == period_year,
                        model.period_quarter == period_quarter,
                    ).first()

                annual = query.filter(
                    model.period_type == 'annual',
                    model.period_year == period_year,
                ).first()
                if annual:
                    return annual

                return query.filter(
                    model.period_type == 'quarterly',
                    model.period_year == period_year,
                    model.period_quarter == 4,
                ).first()

            def previous_comparable(model, current):
                if not current:
                    return None

                current_quarter = current.period_quarter or 0
                if current_quarter > 0:
                    comparable = session.query(model).filter(
                        model.company_id == company.id,
                        model.period_type == 'quarterly',
                        model.period_year == current.period_year - 1,
                        model.period_quarter == current_quarter,
                    ).first()
                    if comparable:
                        return comparable
                else:
                    comparable = session.query(model).filter(
                        model.company_id == company.id,
                        model.period_type == 'annual',
                        model.period_year == current.period_year - 1,
                    ).first()
                    if comparable:
                        return comparable

                return session.query(model).filter(
                    model.company_id == company.id,
                    (
                        (model.period_year < current.period_year) |
                        (
                            (model.period_year == current.period_year) &
                            (model.period_quarter < current_quarter)
                        )
                    ),
                ).order_by(model.period_year.desc(), model.period_quarter.desc()).first()

            def history_until(model, current, count):
                query = session.query(model).filter(model.company_id == company.id)
                if current:
                    current_quarter = current.period_quarter or 0
                    query = query.filter(
                        (
                            (model.period_year < current.period_year) |
                            (
                                (model.period_year == current.period_year) &
                                (model.period_quarter <= current_quarter)
                            )
                        )
                    )
                return query.order_by(model.period_year.desc(), model.period_quarter.desc()).limit(count).all()

            balance = period_query(BalanceSheet)
            income = period_query(IncomeStatement)
            cash_flow = period_query(CashFlow)
            if period_year and (not balance or not income):
                continue
            prev_balance = previous_comparable(BalanceSheet, balance)
            prev_income = previous_comparable(IncomeStatement, income)
            income_list = history_until(IncomeStatement, income, 4) if income else latest_query(IncomeStatement).limit(4).all()
            cash_flows = history_until(CashFlow, cash_flow, 4) if cash_flow else latest_query(CashFlow).limit(4).all()
            
            filter_price, filter_price_date = get_price_at_or_before(company.ticker, period_end_date)
            analysis_company = copy.copy(company)
            if period_end_date:
                analysis_company.current_price = filter_price
                analysis_company.market_cap = filter_price * company.shares_outstanding if filter_price and company.shares_outstanding else None

            # Calculate ratios. For historical periods, price-dependent ratios use only
            # prices available at or before the selected period end date.
            ratios = calculate_financial_ratios(analysis_company, balance, income, prev_income, prev_balance)

            f_score_data = calculate_piotroski_f_score(
                balance, prev_balance, income, prev_income, cash_flow,
                company.shares_outstanding or 0
            )
            f_score = f_score_data.get('total_score', 0)
            warnings = detect_risk_warnings(income_list, cash_flows, balance, ratios)
            health = calculate_health_score(f_score, ratios, warnings)
            
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
            if min_f_score is not None and f_score < min_f_score:
                passed = False
            
            if passed:
                results.append({
                    "ticker": company.ticker,
                    "name": company.name,
                    "industry": company.industry,
                    "period_year": income.period_year if income else (balance.period_year if balance else None),
                    "period_quarter": income.period_quarter if income else (balance.period_quarter if balance else None),
                    "price": company.current_price,
                    "filter_price": filter_price if period_end_date else company.current_price,
                    "filter_price_date": filter_price_date,
                    "market_cap": company.market_cap,
                    "f_score": f_score,
                    "health_score": health.get('total_score'),
                    "health_breakdown": health.get('breakdown'),
                    "health_interpretation": health.get('interpretation'),
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
                "industry": industry,
                "period_year": period_year,
                "period_quarter": period_quarter,
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
            [sys.executable, os.path.join(get_project_root(), "update_stock_prices.py")],
            capture_output=True,
            text=True,
            timeout=240,
            cwd=get_project_root(),
        )
        
        return {
            "success": result.returncode == 0,
            "message": "Price update completed" if result.returncode == 0 else "Update failed",
            "output": result.stdout[-1000:] if result.stdout else None,
            "errors": result.stderr[-500:] if result.stderr else None
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "message": "Update timeout (>240s)"}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ============ Run Server ============

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True
    )
