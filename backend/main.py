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
import threading
import time
from datetime import datetime
import logging

class UvicornAccessFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage()
        if "/api/market/status" in msg or "/api/companies" in msg or "/ws/notifications" in msg:
            return False
        return True

class OutputFilter:
    def __init__(self, original_stdout):
        self.original_stdout = original_stdout

    def write(self, text):
        if "Vnstock 4" in text or "Vnai 2" in text or "Update: pip install" in text or "Release: https" in text or "Current:" in text or "📦" in text:
            return
        self.original_stdout.write(text)

    def flush(self):
        self.original_stdout.flush()

sys.stdout = OutputFilter(sys.stdout)
sys.stderr = OutputFilter(sys.stderr)

# Apply logging filter
logging.getLogger("uvicorn.access").addFilter(UvicornAccessFilter())

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
# from backend.fastapi_auth.app.routes.value_router import router as value_router
from backend.fastapi_auth.app.routes.saved_filter_router import router as saved_filter_router
from backend.fastapi_auth.app.routes.screener_router import router as screener_router
from backend.fastapi_auth.app.routes.company_router import router as company_router
from backend.fastapi_auth.app.routes.market_router import router as market_router
from backend.fastapi_auth.app.routes.market_router import _fetch_index, _market_session
from backend.fastapi_auth.app.routes.compare_router import router as compare_router
from backend.fastapi_auth.app.ws import manager as notification_manager
from backend.fastapi_auth.app.ws import serialize_notification

# Global state for the background price updater.
price_update_task = None
price_update_running = False
price_update_lock = threading.Lock()
price_update_lock_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".price_update.lock")

PRICE_UPDATE_INTERVAL_SECONDS = int(os.getenv("PRICE_UPDATE_INTERVAL_SECONDS", "900")) # 15 minutes
MARKET_STATUS_CHECK_INTERVAL_SECONDS = int(os.getenv("MARKET_STATUS_CHECK_INTERVAL_SECONDS", "900")) # 15 minutes
AUTO_PRICE_UPDATE_ENABLED = os.getenv("AUTO_PRICE_UPDATE_ENABLED", "1").lower() not in {"0", "false", "no", "off"}

price_update_state = {
    "enabled": AUTO_PRICE_UPDATE_ENABLED,
    "scheduler_status": "starting",
    "market_status": None,
    "market_is_open": False,
    "last_market_check": None,
    "next_market_check": None,
    "last_run_started_at": None,
    "last_run_finished_at": None,
    "last_run_success": None,
    "last_run_message": None,
    "last_updated_count": None,
    "last_total_count": None,
    "next_price_update": None,
    "skipped_reason": None,
}


def _json_safe(value):
    """Recursively convert pandas/numpy null-like values to JSON-safe None."""
    if value is None:
        return None

    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}

    if isinstance(value, list):
        return [_json_safe(item) for item in value]

    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]

    if pd.isna(value):
        return None

    return value

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


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _set_price_update_state(**updates):
    price_update_state.update(updates)


def _acquire_price_update_file_lock() -> bool:
    """Prevent multiple app workers from running the price updater at the same time."""
    stale_after = max(PRICE_UPDATE_INTERVAL_SECONDS * 3, 600)

    try:
        if os.path.exists(price_update_lock_file):
            lock_age = time.time() - os.path.getmtime(price_update_lock_file)
            if lock_age > stale_after:
                os.remove(price_update_lock_file)

        fd = os.open(price_update_lock_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        with os.fdopen(fd, "w", encoding="utf-8") as lock_file:
            lock_file.write(f"{os.getpid()} {time.time()}\n")
        return True
    except FileExistsError:
        return False
    except Exception as error:
        print(f"[Price Update] Khong tao duoc lock file: {error}")
        return False


def _release_price_update_file_lock():
    try:
        if os.path.exists(price_update_lock_file):
            os.remove(price_update_lock_file)
    except Exception as error:
        print(f"[Price Update] Khong xoa duoc lock file: {error}")





def run_price_update_sync_locked():
    """Run update_stock_prices.py with process-safe locking and observable state."""
    global price_update_running

    if not price_update_lock.acquire(blocking=False):
        message = "Dang co tien trinh cap nhat gia trong process nay, bo qua."
        print(f"[Price Update] {message}")
        _set_price_update_state(skipped_reason=message, last_run_message=message)
        return {"started": False, "success": False, "message": message}

    if not _acquire_price_update_file_lock():
        price_update_lock.release()
        message = "Dang co worker/process khac cap nhat gia, bo qua."
        print(f"[Price Update] {message}")
        _set_price_update_state(skipped_reason=message, last_run_message=message)
        return {"started": False, "success": False, "message": message}

    price_update_running = True
    _set_price_update_state(
        scheduler_status="updating",
        last_run_started_at=_now_iso(),
        last_run_finished_at=None,
        last_run_success=None,
        last_run_message="Dang cap nhat gia",
        skipped_reason=None,
    )

    project_root = get_project_root()
    script_path = os.path.join(project_root, "update_stock_prices.py")

    try:
        if not os.path.exists(script_path):
            message = f"Khong tim thay script: {script_path}"
            _set_price_update_state(
                last_run_finished_at=_now_iso(),
                last_run_success=False,
                last_run_message=message,
            )
            return {"started": True, "success": False, "message": message}

        print("[Price Update] Dang cap nhat gia co phieu...")
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"

        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=240,
            cwd=project_root,
            env=env,
            encoding="utf-8",
            errors="replace",
        )

        output = result.stdout.strip() if result.stdout else ""
        if result.returncode == 0:
            import re

            updated_count = None
            total_count = None
            match = re.search(r"(\d+)/(\d+)", output)
            if match:
                updated_count, total_count = [int(value) for value in match.groups()]
                message = f"Cap nhat gia thanh cong ({updated_count}/{total_count} ma)"
            else:
                message = "Cap nhat gia thanh cong"

            print(f"[Price Update] {message}")
            _set_price_update_state(
                last_run_finished_at=_now_iso(),
                last_run_success=True,
                last_run_message=message,
                last_updated_count=updated_count,
                last_total_count=total_count,
            )
            return {
                "started": True,
                "success": True,
                "message": message,
                "updated_count": updated_count,
                "total_count": total_count,
            }

        error_msg = result.stderr[:500] if result.stderr else "Unknown error"
        message = f"Cap nhat gia loi: {error_msg}"
        print(f"[Price Update] {message}")
        _set_price_update_state(
            last_run_finished_at=_now_iso(),
            last_run_success=False,
            last_run_message=message,
        )
        return {"started": True, "success": False, "message": message}

    except subprocess.TimeoutExpired:
        message = "Cap nhat gia qua thoi gian 4 phut, bo qua."
        print(f"[Price Update] {message}")
        _set_price_update_state(
            last_run_finished_at=_now_iso(),
            last_run_success=False,
            last_run_message=message,
        )
        return {"started": True, "success": False, "message": message}
    except Exception as error:
        message = f"Loi cap nhat gia: {error}"
        print(f"[Price Update] {message}")
        _set_price_update_state(
            last_run_finished_at=_now_iso(),
            last_run_success=False,
            last_run_message=message,
        )
        return {"started": True, "success": False, "message": message}
    finally:
        price_update_running = False
        _release_price_update_file_lock()
        price_update_lock.release()


import concurrent.futures
_price_update_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)

async def update_stock_prices_async():
    """Chạy script cập nhật giá cổ phiếu trong thread pool"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_price_update_executor, run_price_update_sync_locked)



async def market_aware_price_update_scheduler():
    """Update prices: always once on startup, then only while market is open."""
    if not AUTO_PRICE_UPDATE_ENABLED:
        _set_price_update_state(
            scheduler_status="disabled",
            skipped_reason="AUTO_PRICE_UPDATE_ENABLED=0",
        )
        print("[Price Scheduler] Auto price update disabled by environment.")
        return

    # --- Always run one update on startup regardless of market status ---
    print("[Price Scheduler] Startup: running initial price update...")
    _set_price_update_state(
        scheduler_status="startup_update",
        last_run_message="Dang cap nhat gia lan dau khi khoi dong",
        skipped_reason=None,
    )
    await update_stock_prices_async()
    print("[Price Scheduler] Startup price update completed.")

    # --- After initial update, follow market-aware schedule ---
    while True:
        try:
            market_snapshot = _market_session()
            
            _set_price_update_state(
                scheduler_status="market_open" if market_snapshot.get("is_open") else "market_closed",
                market_status=market_snapshot.get("status"),
                market_is_open=bool(market_snapshot.get("is_open")),
                last_market_check=_now_iso(),
                next_market_check=datetime.fromtimestamp(
                    time.time() + (PRICE_UPDATE_INTERVAL_SECONDS if market_snapshot.get("is_open") else MARKET_STATUS_CHECK_INTERVAL_SECONDS)
                ).isoformat(timespec="seconds"),
                skipped_reason=None if market_snapshot.get("is_open") else market_snapshot.get("message"),
            )
            
            print(
                f"[Price Scheduler] Market status: {market_snapshot.get('status')} - {market_snapshot.get('message')}"
            )

            if not market_snapshot.get("is_open"):
                _set_price_update_state(
                    scheduler_status="market_closed",
                    next_price_update=None,
                )
                await asyncio.sleep(MARKET_STATUS_CHECK_INTERVAL_SECONDS)
                continue

            _set_price_update_state(
                scheduler_status="market_open",
                next_price_update=datetime.fromtimestamp(
                    time.time() + PRICE_UPDATE_INTERVAL_SECONDS
                ).isoformat(timespec="seconds"),
            )
            
            await update_stock_prices_async()
            
            _set_price_update_state(
                scheduler_status="market_open",
                next_price_update=datetime.fromtimestamp(
                    time.time() + PRICE_UPDATE_INTERVAL_SECONDS
                ).isoformat(timespec="seconds"),
            )
            await asyncio.sleep(PRICE_UPDATE_INTERVAL_SECONDS)
            
        except Exception as e:
            print(f"[Price Scheduler] Error in scheduler loop: {e}")
            await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Quản lý vòng đời ứng dụng - khởi động và dừng background tasks"""
    global price_update_task
    
    print(" Khởi động background task cập nhật giá cổ phiếu...")
    # Khởi động task cập nhật giá
    price_update_task = asyncio.create_task(market_aware_price_update_scheduler())
    
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
# app.include_router(value_router)
app.include_router(saved_filter_router)
app.include_router(screener_router)
app.include_router(company_router)
app.include_router(market_router)
app.include_router(compare_router)


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

class CompareRequest(BaseModel):
    tickers: List[str]


class IntrinsicValueRequest(BaseModel):
    growth_rate: float
    discount_rate: float
    years: int = 5


# ============ API Endpoints ============

@app.get("/")
async def root():
    """API Health check"""
    return {
        "message": f"Welcome to {APP_NAME}",
        "version": APP_VERSION,
        "status": "running",
        "price_update": "Auto-update every 2 minutes while market is open"
    }


# @app.post("/api/prices/refresh")
# async def refresh_prices():
#     """Trigger cập nhật giá cổ phiếu thủ công"""
#     from fastapi import BackgroundTasks
    
#     # Chạy cập nhật trong background
#     asyncio.create_task(update_stock_prices_async())
    
#     return {
#         "status": "started",
#         "message": "Đang cập nhật giá cổ phiếu trong nền..."
#     }


# @app.get("/api/prices/status")
# async def get_price_status():
#     """Kiểm tra trạng thái cập nhật giá"""
#     try:
#         return {
#             **price_update_state,
#             "status": price_update_state.get("scheduler_status", "unknown"),
#             "auto_update_enabled": AUTO_PRICE_UPDATE_ENABLED,
#             "auto_update_interval_seconds": PRICE_UPDATE_INTERVAL_SECONDS,
#             "market_check_interval_seconds": MARKET_STATUS_CHECK_INTERVAL_SECONDS,
#             "message": (
#                 "Gia co phieu chi duoc cap nhat tu dong khi thi truong mo cua."
#                 if AUTO_PRICE_UPDATE_ENABLED
#                 else "Auto price update is disabled."
#             ),
#         }
#     except Exception as e:
#         return {"status": "unknown", "error": str(e)}


# ============ Advanced Analysis APIs ============

# @app.get("/api/analysis/{ticker}/ratios")
# async def get_financial_ratios(ticker: str, year: Optional[int] = None):
#     """
#     Lấy tất cả chỉ số tài chính của một công ty
#     Bao gồm: ROE, ROA, P/E, P/B, D/E, margins, growth rates, EPS, BVPS...
#     """
#     from backend.financial_analysis import calculate_financial_ratios
#     from sqlalchemy import create_engine
#     from sqlalchemy.orm import sessionmaker
#     from Database.models import Company, BalanceSheet, IncomeStatement, CashFlow
    
#     engine = create_engine(DATABASE_URL)
#     Session = sessionmaker(bind=engine)
#     session = Session()
    
#     try:
#         company = session.query(Company).filter(Company.ticker == ticker.upper()).first()
#         if not company:
#             raise HTTPException(status_code=404, detail=f"Không tìm thấy mã {ticker}")
        
#         # Get latest financial data
#         balance_query = session.query(BalanceSheet).filter(
#             BalanceSheet.company_id == company.id
#         ).order_by(BalanceSheet.period_year.desc(), BalanceSheet.period_quarter.desc())
        
#         income_query = session.query(IncomeStatement).filter(
#             IncomeStatement.company_id == company.id
#         ).order_by(IncomeStatement.period_year.desc(), IncomeStatement.period_quarter.desc())
        
#         if year:
#             balance_query = balance_query.filter(BalanceSheet.period_year == year)
#             income_query = income_query.filter(IncomeStatement.period_year == year)
        
#         balance_sheet = balance_query.first()
#         income_statement = income_query.first()
        
#         # Get previous period for growth calculation
#         prev_income = session.query(IncomeStatement).filter(
#             IncomeStatement.company_id == company.id,
#             IncomeStatement.period_year == (balance_sheet.period_year - 1 if balance_sheet else 2024)
#         ).first()
        
#         prev_balance = session.query(BalanceSheet).filter(
#             BalanceSheet.company_id == company.id,
#             BalanceSheet.period_year == (balance_sheet.period_year - 1 if balance_sheet else 2024)
#         ).first()
        
#         ratios = calculate_financial_ratios(
#             company, balance_sheet, income_statement, prev_income, prev_balance
#         )
        
#         return {
#             "ticker": ticker.upper(),
#             "company_name": company.name,
#             "company_type": company.company_type,
#             "industry": company.industry,
#             "period": {
#                 "year": balance_sheet.period_year if balance_sheet else None,
#                 "quarter": balance_sheet.period_quarter if balance_sheet else None
#             },
#             "ratios": ratios
#         }
#     finally:
#         session.close()


# @app.get("/api/analysis/{ticker}/f-score")
# async def get_f_score(ticker: str):
#     """
#     Tính Piotroski F-Score (0-9) cho một công ty
#     Đánh giá sức khỏe tài chính theo 9 tiêu chí
#     """
#     from backend.financial_analysis import calculate_piotroski_f_score
#     from sqlalchemy import create_engine
#     from sqlalchemy.orm import sessionmaker
#     from Database.models import Company, BalanceSheet, IncomeStatement, CashFlow
    
#     engine = create_engine(DATABASE_URL)
#     Session = sessionmaker(bind=engine)
#     session = Session()
    
#     try:
#         company = session.query(Company).filter(Company.ticker == ticker.upper()).first()
#         if not company:
#             raise HTTPException(status_code=404, detail=f"Không tìm thấy mã {ticker}")
        
#         # Get latest and previous year data
#         balance_sheets = session.query(BalanceSheet).filter(
#             BalanceSheet.company_id == company.id
#         ).order_by(BalanceSheet.period_year.desc(), BalanceSheet.period_quarter.desc()).limit(2).all()
        
#         income_statements = session.query(IncomeStatement).filter(
#             IncomeStatement.company_id == company.id
#         ).order_by(IncomeStatement.period_year.desc(), IncomeStatement.period_quarter.desc()).limit(2).all()
        
#         cash_flows = session.query(CashFlow).filter(
#             CashFlow.company_id == company.id
#         ).order_by(CashFlow.period_year.desc(), CashFlow.period_quarter.desc()).limit(1).all()
        
#         balance = balance_sheets[0] if balance_sheets else None
#         prev_balance = balance_sheets[1] if len(balance_sheets) > 1 else None
#         income = income_statements[0] if income_statements else None
#         prev_income = income_statements[1] if len(income_statements) > 1 else None
#         cash_flow = cash_flows[0] if cash_flows else None
        
#         f_score = calculate_piotroski_f_score(
#             balance, prev_balance, income, prev_income, cash_flow,
#             company.shares_outstanding or 0
#         )
        
#         return {
#             "ticker": ticker.upper(),
#             "company_name": company.name,
#             "f_score": f_score
#         }
#     finally:
#         session.close()


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


# @app.get("/api/value/companies/{ticker}/analysis")
# async def value_analysis(ticker: str, years: int = Query(10, ge=5, le=15)):
#     df = db.get_long_term_metrics(ticker.upper(), years)
#     if df.empty:
#         raise HTTPException(status_code=404, detail=f"Không có dữ liệu dài hạn cho mã {ticker}")

#     revenue_trend = _trend_label(df["revenue"].tolist())
#     profit_trend = _trend_label(df["net_profit"].tolist())
#     revenue_consistency = _consistency_label(df["revenue_growth"].tolist())
#     profit_consistency = _consistency_label(df["profit_growth"].tolist())

#     latest = df.iloc[-1]
#     debt_to_equity = None
#     if latest.get("total_equity") and latest.get("total_equity") != 0:
#         debt_to_equity = latest.get("total_liabilities") / latest.get("total_equity")

#     summary = []
#     if revenue_consistency == "consistent" and profit_consistency == "consistent":
#         summary.append("Consistent growth over 5 years")
#     if profit_trend == "decreasing":
#         summary.append("Declining profitability")
#     if debt_to_equity and debt_to_equity > 1.5:
#         summary.append("High debt relative to equity")
#     if revenue_trend == "flat" and profit_trend == "flat":
#         summary.append("Flat growth trend")

#     return {
#         "ticker": ticker.upper(),
#         "time_series": df.where(pd.notnull(df), None).to_dict(orient="records"),
#         "summary": summary,
#         "trends": {
#             "revenue": revenue_trend,
#             "profit": profit_trend,
#         },
#         "consistency": {
#             "revenue_growth": revenue_consistency,
#             "profit_growth": profit_consistency,
#         },
#     }


class IntrinsicValueRequest(BaseModel):
    growth_rate: float
    discount_rate: float
    years: int = 5


# @app.post("/api/value/companies/{ticker}/intrinsic-value")
# async def intrinsic_value(ticker: str, payload: IntrinsicValueRequest):
#     df = db.get_long_term_metrics(ticker.upper(), max(payload.years, 5))
#     if df.empty:
#         raise HTTPException(status_code=404, detail=f"Không có dữ liệu dài hạn cho mã {ticker}")

#     latest = df.iloc[-1]
#     fcf = latest.get("free_cash_flow")
#     intrinsic_total = _compute_intrinsic_value(fcf, payload.growth_rate, payload.discount_rate, payload.years)
#     shares = latest.get("shares_outstanding")
#     intrinsic_per_share = None
#     if intrinsic_total is not None and shares and shares > 0:
#         intrinsic_per_share = intrinsic_total / shares

#     return {
#         "ticker": ticker.upper(),
#         "intrinsic_value": intrinsic_per_share,
#         "assumptions": {
#             "growth_rate": payload.growth_rate,
#             "discount_rate": payload.discount_rate,
#             "years": payload.years,
#             "base_free_cash_flow": fcf,
#         },
#     }


# @app.get("/api/value/companies/{ticker}/margin-of-safety")
# async def margin_of_safety(
#     ticker: str,
#     growth_rate: float = Query(8.0),
#     discount_rate: float = Query(12.0),
#     years: int = Query(5, ge=3, le=10),
# ):
#     df = db.get_long_term_metrics(ticker.upper(), max(years, 5))
#     if df.empty:
#         raise HTTPException(status_code=404, detail=f"Không có dữ liệu dài hạn cho mã {ticker}")

#     latest = df.iloc[-1]
#     fcf = latest.get("free_cash_flow")
#     intrinsic_total = _compute_intrinsic_value(fcf, growth_rate, discount_rate, years)
#     shares = latest.get("shares_outstanding")
#     intrinsic_per_share = None
#     if intrinsic_total is not None and shares and shares > 0:
#         intrinsic_per_share = intrinsic_total / shares

#     market_price = latest.get("current_price")
#     margin = None
#     label = None
#     if intrinsic_per_share and market_price:
#         margin = (intrinsic_per_share - market_price) / intrinsic_per_share
#         if margin > 0.15:
#             label = "Undervalued"
#         elif margin < -0.15:
#             label = "Overvalued"
#         else:
#             label = "Fairly valued"

#     return {
#         "ticker": ticker.upper(),
#         "market_price": market_price,
#         "intrinsic_value": intrinsic_per_share,
#         "margin_of_safety": margin,
#         "label": label,
#         "assumptions": {
#             "growth_rate": growth_rate,
#             "discount_rate": discount_rate,
#             "years": years,
#         },
#     }


# @app.get("/api/value/companies/{ticker}/insights")
# async def investment_insights(ticker: str):
#     df = db.get_long_term_metrics(ticker.upper(), 10)
#     if df.empty:
#         raise HTTPException(status_code=404, detail=f"Không có dữ liệu dài hạn cho mã {ticker}")

#     insights = []
#     if (df["roe"].tail(5) >= 20).all():
#         insights.append("Company has maintained ROE above 20% for 5 years")

#     revenue_growth = df["revenue_growth"].dropna().tail(3).tolist()
#     if len(revenue_growth) == 3 and revenue_growth[2] < revenue_growth[0]:
#         insights.append("Revenue growth is slowing down")

#     debt_series = df["debt"].dropna().tolist()
#     if _trend_label(debt_series) == "increasing":
#         insights.append("Debt level is increasing significantly")

#     if not insights:
#         insights.append("No major long-term red flags detected")

#     return {
#         "ticker": ticker.upper(),
#         "insights": insights,
#     }


# @app.get("/api/value/companies/{ticker}/health-score")
# async def value_health_score(ticker: str):
#     df = db.get_long_term_metrics(ticker.upper(), 10)
#     if df.empty:
#         raise HTTPException(status_code=404, detail=f"Không có dữ liệu dài hạn cho mã {ticker}")

#     latest = df.iloc[-1]
#     roe = latest.get("roe") or 0
#     revenue_growth = latest.get("revenue_growth") or 0
#     profit_growth = latest.get("profit_growth") or 0
#     debt_to_equity = None
#     if latest.get("total_equity") and latest.get("total_equity") != 0:
#         debt_to_equity = latest.get("total_liabilities") / latest.get("total_equity")
#     fcf = latest.get("free_cash_flow") or 0

#     profitability = min(10, max(0, roe / 2))
#     growth = min(10, max(0, (revenue_growth + profit_growth) / 4))
#     debt_score = 10 if debt_to_equity is None else max(0, 10 - (debt_to_equity * 4))
#     efficiency = 10 if fcf > 0 else 4

#     overall = round((profitability + growth + debt_score + efficiency) / 4, 2)

#     return {
#         "ticker": ticker.upper(),
#         "overall": overall,
#         "breakdown": {
#             "profitability": round(profitability, 2),
#             "growth": round(growth, 2),
#             "debt": round(debt_score, 2),
#             "efficiency": round(efficiency, 2),
#         },
#     }



# # ============ Value Investing APIs ============




# # ============ Financial Statements (served by company_router) ============
# # These endpoints are now handled by company_router.py


    
#     try:
#         company = session.query(Company).filter(Company.ticker == ticker.upper()).first()
#         if not company:
#             raise HTTPException(status_code=404, detail=f"Không tìm thấy mã {ticker}")
        
#         # Get all financial data
#         balance_sheets = session.query(BalanceSheet).filter(
#             BalanceSheet.company_id == company.id
#         ).order_by(BalanceSheet.period_year.desc(), BalanceSheet.period_quarter.desc()).all()
        
#         income_statements = session.query(IncomeStatement).filter(
#             IncomeStatement.company_id == company.id
#         ).order_by(IncomeStatement.period_year.desc(), IncomeStatement.period_quarter.desc()).all()
        
#         cash_flows = session.query(CashFlow).filter(
#             CashFlow.company_id == company.id
#         ).order_by(CashFlow.period_year.desc(), CashFlow.period_quarter.desc()).all()
        
#         if format.lower() == "csv":
#             # Create CSV
#             output = io.StringIO()
            
#             # Company info
#             output.write(f"# {company.ticker} - {company.name}\n")
#             output.write(f"# Industry: {company.industry}\n")
#             output.write(f"# Export Date: {pd.Timestamp.now().strftime('%Y-%m-%d')}\n\n")
            
#             # Income Statement
#             output.write("=== INCOME STATEMENT ===\n")
#             output.write("Year,Quarter,Revenue,Gross Profit,Operating Income,Net Profit\n")
#             for is_ in income_statements:
#                 output.write(f"{is_.period_year},{is_.period_quarter or 'Annual'},{is_.revenue or 0},{is_.gross_profit or 0},{is_.operating_income or 0},{is_.net_profit or 0}\n")
            
#             output.write("\n=== BALANCE SHEET ===\n")
#             output.write("Year,Quarter,Total Assets,Total Liabilities,Total Equity,Cash,Inventories\n")
#             for bs in balance_sheets:
#                 output.write(f"{bs.period_year},{bs.period_quarter or 'Annual'},{bs.total_assets or 0},{bs.total_liabilities or 0},{bs.total_equity or 0},{bs.cash_and_equivalents or 0},{bs.inventories or 0}\n")
            
#             output.write("\n=== CASH FLOW ===\n")
#             output.write("Year,Quarter,Operating CF,Investing CF,Financing CF,Net Change\n")
#             for cf in cash_flows:
#                 output.write(f"{cf.period_year},{cf.period_quarter or 'Annual'},{cf.operating_cash_flow or 0},{cf.investing_cash_flow or 0},{cf.financing_cash_flow or 0},{cf.net_change_in_cash or 0}\n")
            
#             return Response(
#                 content=output.getvalue(),
#                 media_type="text/csv",
#                 headers={"Content-Disposition": f"attachment; filename={ticker}_financial_data.csv"}
#             )
        
#         # JSON format
#         return {
#             "company": {
#                 "ticker": company.ticker,
#                 "name": company.name,
#                 "industry": company.industry,
#                 "current_price": company.current_price,
#                 "market_cap": company.market_cap,
#                 "shares_outstanding": company.shares_outstanding
#             },
#             "income_statements": [
#                 {
#                     "year": is_.period_year,
#                     "quarter": is_.period_quarter,
#                     "revenue": is_.revenue,
#                     "gross_profit": is_.gross_profit,
#                     "operating_income": is_.operating_income,
#                     "net_profit": is_.net_profit
#                 }
#                 for is_ in income_statements
#             ],
#             "balance_sheets": [
#                 {
#                     "year": bs.period_year,
#                     "quarter": bs.period_quarter,
#                     "total_assets": bs.total_assets,
#                     "total_liabilities": bs.total_liabilities,
#                     "total_equity": bs.total_equity,
#                     "cash_and_equivalents": bs.cash_and_equivalents,
#                     "inventories": bs.inventories,
#                     "current_assets": bs.current_assets,
#                     "current_liabilities": bs.current_liabilities
#                 }
#                 for bs in balance_sheets
#             ],
#             "cash_flows": [
#                 {
#                     "year": cf.period_year,
#                     "quarter": cf.period_quarter,
#                     "operating_cash_flow": cf.operating_cash_flow,
#                     "investing_cash_flow": cf.investing_cash_flow,
#                     "financing_cash_flow": cf.financing_cash_flow,
#                     "net_change_in_cash": cf.net_change_in_cash,
#                     "capex": cf.capex
#                 }
#                 for cf in cash_flows
#             ],
#             "export_date": pd.Timestamp.now().isoformat()
#         }
#     finally:
#         session.close()




# @app.post("/api/update-prices")
# async def trigger_price_update():
#     """Trigger a manual price update through the shared lock-protected updater."""
#     result = await update_stock_prices_async()
#     return {
#         "success": bool(result and result.get("success")),
#         "started": bool(result and result.get("started")),
#         "message": result.get("message") if result else "Price update did not start",
#         "state": price_update_state,
#     }


# ============ Run Server ============

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True
    )
