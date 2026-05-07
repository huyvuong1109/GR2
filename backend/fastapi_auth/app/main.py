from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .db import engine, Base
from .models import User, Watchlist, Notification
from .routes.auth_router import router as auth_router
from .routes.user_router import router as user_router
from .routes.watchlist_router import router as watchlist_router
from .routes.notifications_router import router as notifications_router
from .routes.company_router import router as company_router
from .routes.analysis_router import router as analysis_router
from .routes.screener_router import router as screener_router
from .routes.ticker_groups_router import router as ticker_groups_router
from .routes.market_router import router as market_router
from .routes.compare_router import router as compare_router
from .routes.value_router import router as value_router
from .routes.saved_filter_router import router as saved_filter_router
from .db import SessionLocal
from .auth import decode_token
from . import crud
from .ws import manager, serialize_notification
import os

# Create DB file and tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Financial Platform Auth API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://localhost:3002", 
        "http://localhost:3000", 
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:8080",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(watchlist_router)
app.include_router(notifications_router)
app.include_router(company_router)
app.include_router(analysis_router)
app.include_router(screener_router)
app.include_router(ticker_groups_router)
app.include_router(market_router)
app.include_router(compare_router)
app.include_router(value_router)
app.include_router(saved_filter_router)

@app.websocket('/ws/notifications')
async def notifications_ws(websocket: WebSocket):
    token = websocket.query_params.get('token')
    if not token:
        await websocket.close(code=1008)
        return

    payload = decode_token(token)
    if not payload or not payload.get('sub'):
        await websocket.close(code=1008)
        return

    try:
        user_id = int(payload.get('sub'))
    except (TypeError, ValueError):
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    try:
        user = crud.get_user(db, user_id)
        if not user:
            await websocket.close(code=1008)
            return
        await manager.connect(user_id, websocket)
        notifications = crud.list_notifications(db, user_id=user_id, unread_only=False)
        await websocket.send_json({
            'type': 'init',
            'notifications': [serialize_notification(n) for n in notifications]
        })
        while True:
            message = await websocket.receive_text()
            if message == 'ping':
                await websocket.send_text('pong')
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, websocket)
        db.close()

@app.get('/')
def root():
    return {"status":"ok", "message":"Auth API running"}
