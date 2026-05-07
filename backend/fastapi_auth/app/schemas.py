from pydantic import BaseModel, EmailStr
from typing import Optional, List

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    username: str
    theme_pref: Optional[str] = None

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class WatchlistItem(BaseModel):
    ticker: str

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    data: Optional[str]
    type: Optional[str]
    is_read: bool
    created_at: str

class SavedFilterCreate(BaseModel):
    name: str
    conditions: str

class SavedFilterOut(BaseModel):
    id: int
    name: str
    conditions: str
    created_at: str
