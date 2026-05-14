from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from ..db import SessionLocal
from .. import crud
from ..ws import manager
from .user_router import get_current_user
import json

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"]) 
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_db():
    db = SessionLocal();
    try: yield db
    finally: db.close()

@router.post('/add')
async def add(item: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    ticker = item.get('ticker')
    if not ticker:
        raise HTTPException(400, 'Missing ticker')
    symbol = ticker.upper()
    already_exists = crud.is_in_watchlist(db, current_user.id, symbol)
    crud.add_watchlist(db, current_user.id, symbol)

    if not already_exists:
        notification = crud.create_notification(
            db,
            user_id=current_user.id,
            title="Đã thêm vào danh mục quan tâm",
            message=f"{symbol} đã được thêm vào danh mục quan tâm của bạn.",
            data=json.dumps({"ticker": symbol, "action": "watchlist_add"}),
            ntype="success",
        )
        await manager.emit_notification(notification)

    return {"ok": True, "ticker": symbol, "already_exists": already_exists}

@router.post('/remove')
@router.delete('/remove')
async def remove(item: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    ticker = item.get('ticker')
    if not ticker:
        raise HTTPException(400, 'Missing ticker')
    symbol = ticker.upper()
    ok = crud.remove_watchlist(db, current_user.id, symbol)
    if not ok:
        raise HTTPException(404, 'Ticker not found in watchlist')

    notification = crud.create_notification(
        db,
        user_id=current_user.id,
        title="Đã xoá khỏi danh mục quan tâm",
        message=f"{symbol} đã được xoá khỏi danh mục quan tâm của bạn.",
        data=json.dumps({"ticker": symbol, "action": "watchlist_remove"}),
        ntype="info",
    )
    await manager.emit_notification(notification)

    return {"ok": True, "ticker": symbol}

@router.get('')
def list_watchlist(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    items = crud.list_watchlist(db, current_user.id)
    return [{"ticker": it.ticker, "added_at": it.added_at.isoformat()} for it in items]
