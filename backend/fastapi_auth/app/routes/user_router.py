from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from ..db import SessionLocal
from .. import crud, schemas
from ..auth import decode_token

router = APIRouter(prefix="/api/user", tags=["user"]) 
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = int(payload.get('sub'))
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@router.get('/me', response_model=schemas.UserOut)
def me(current_user=Depends(get_current_user)):
    return schemas.UserOut(id=current_user.id, email=current_user.email, username=current_user.username, theme_pref=current_user.theme_pref)

@router.put('/me')
def update_me(payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    # Simple update: only theme_pref supported here
    tp = payload.get('theme_pref')
    if tp:
        current_user.theme_pref = tp
        db.add(current_user); db.commit(); db.refresh(current_user)
    return {"ok": True}
