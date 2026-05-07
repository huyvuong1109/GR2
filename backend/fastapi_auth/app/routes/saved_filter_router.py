from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .. import crud, schemas
from ..db import SessionLocal
from .user_router import get_current_user

router = APIRouter(prefix="/api/user/saved-filters", tags=["saved-filters"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=schemas.SavedFilterOut)
def create_saved_filter(
    filter_in: schemas.SavedFilterCreate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.create_saved_filter(db, user.id, filter_in.name, filter_in.conditions)

@router.get("/", response_model=List[schemas.SavedFilterOut])
def get_saved_filters(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    filters = crud.get_saved_filters(db, user.id)
    return [
        schemas.SavedFilterOut(
            id=f.id,
            name=f.name,
            conditions=f.conditions,
            created_at=str(f.created_at)
        ) for f in filters
    ]

@router.delete("/{filter_id}")
def delete_saved_filter(
    filter_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    success = crud.delete_saved_filter(db, user.id, filter_id)
    if not success:
        raise HTTPException(status_code=404, detail="Saved filter not found")
    return {"success": True}
