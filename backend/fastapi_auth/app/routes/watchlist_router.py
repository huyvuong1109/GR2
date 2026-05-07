from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from ..db import SessionLocal
from .. import crud
from .user_router import get_current_user

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"]) 
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_db():
    db = SessionLocal();
    try: yield db
    finally: db.close()

@router.post('/add')
def add(item: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    ticker = item.get('ticker')
    if not ticker:
        raise HTTPException(400, 'Missing ticker')
    crud.add_watchlist(db, current_user.id, ticker.upper())
    return {"ok": True, "ticker": ticker.upper()}

@router.delete('/remove')
def remove(item: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    ticker = item.get('ticker')
    if not ticker:
        raise HTTPException(400, 'Missing ticker')
    ok = crud.remove_watchlist(db, current_user.id, ticker.upper())
    if not ok:
        raise HTTPException(404, 'Ticker not found in watchlist')
    return {"ok": True, "ticker": ticker.upper()}

@router.get('')
def list_watchlist(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    items = crud.list_watchlist(db, current_user.id)
    return [{"ticker": it.ticker, "added_at": it.added_at.isoformat()} for it in items]
