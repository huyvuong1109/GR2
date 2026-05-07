from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, schemas
from ..db import SessionLocal, engine, Base
from ..auth import create_access_token, create_refresh_token, decode_token
from fastapi import Body

router = APIRouter(prefix="/auth", tags=["auth"])

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post('/register', response_model=schemas.UserOut)
def register(payload: dict = Body(...), db: Session = Depends(get_db)):
    email = payload.get('email')
    username = payload.get('username')
    password = payload.get('password')
    
    # Validate inputs
    if not email or not username or not password:
        raise HTTPException(400, detail='Cac truong email, username va mat khau khong duoc de trong')
    
    if len(username) < 3:
        raise HTTPException(400, detail='Ten dang nhap phai co it nhat 3 ky tu')
    
    if len(password) < 6:
        raise HTTPException(400, detail='Mat khau phai co it nhat 6 ky tu')
    
    # Check if email/username exists
    existing_by_username = crud.get_user_by_username_or_email(db, username)
    if existing_by_username:
        raise HTTPException(400, detail='Ten dang nhap da ton tai')
    
    existing_by_email = crud.get_user_by_username_or_email(db, email)
    if existing_by_email:
        raise HTTPException(400, detail='Email da duoc dang ky')
    
    try:
        user = crud.create_user(db, email=email, username=username, password=password)
        return schemas.UserOut(id=user.id, email=user.email, username=user.username, theme_pref=user.theme_pref)
    except Exception as e:
        raise HTTPException(500, detail=f'Co loi khi tao tai khoan: {str(e)}')

@router.post('/login')
def login(payload: dict = Body(...), db: Session = Depends(get_db)):
    identifier = payload.get('username_or_email')
    password = payload.get('password')
    
    if not identifier or not password:
        raise HTTPException(400, detail='Email/username va mat khau khong duoc de trong')
    
    user = crud.verify_user_credentials(db, identifier, password)
    if not user:
        raise HTTPException(401, detail='Email/username hoac mat khau khong dung. Vui long kiem tra lai')
    
    try:
        access = create_access_token({"sub": str(user.id)})
        refresh = create_refresh_token({"sub": str(user.id)})
        return {
            "access_token": access,
            "refresh_token": refresh,
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "theme_pref": user.theme_pref
            }
        }
    except Exception as e:
        raise HTTPException(500, detail=f'Co loi khi dang nhap: {str(e)}')

@router.post('/refresh')
def refresh(payload: dict = Body(...)):
    token = payload.get('refresh_token')
    if not token:
        raise HTTPException(400, detail='Refresh token khong duoc de trong')
    
    data = decode_token(token)
    if not data:
        raise HTTPException(401, detail='Refresh token khong hop le hoac het han')
    
    try:
        user_id = data.get('sub')
        access = create_access_token({"sub": user_id})
        refresh = create_refresh_token({"sub": user_id})
        return {"access_token": access, "refresh_token": refresh}
    except Exception as e:
        raise HTTPException(500, detail=f'Co loi khi lam moi token: {str(e)}')

