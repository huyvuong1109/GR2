from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from ..db import SessionLocal
from .. import crud
from ..models import Notification
from ..ws import manager, serialize_notification
from .user_router import get_current_user
import json

router = APIRouter(prefix="/api/notifications", tags=["notifications"]) 

def get_db():
    db = SessionLocal();
    try: yield db
    finally: db.close()

@router.get('')
def list_notifications(unread_only: bool = False, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    ns = crud.list_notifications(db, user_id=current_user.id, unread_only=unread_only)
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "data": n.data,
            "type": n.type,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat()
        }
        for n in ns
    ]

@router.post('/mark-read')
async def mark_read(payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    nid = payload.get('id')
    if not nid:
        raise HTTPException(400, 'Missing id')
    ok = crud.mark_notification_read(db, nid, current_user.id)
    if not ok:
        raise HTTPException(404, 'Notification not found')
    await manager.send_to_user(current_user.id, {"type": "read", "id": nid})
    return {"ok": True}

@router.delete('/{notification_id}')
async def delete_notification(notification_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        or_(Notification.user_id == current_user.id, Notification.user_id.is_(None))
    ).first()
    if not n:
        raise HTTPException(404, 'Notification not found')
    db.delete(n)
    db.commit()

    payload = {"type": "delete", "id": notification_id}
    if n.user_id is None:
        await manager.send_to_all(payload)
    else:
        await manager.send_to_user(current_user.id, payload)
    return {"ok": True}

@router.post('/push')
async def push_notification(payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    title = payload.get('title')
    message = payload.get('message')
    if not title or not message:
        raise HTTPException(400, 'Missing title or message')

    user_id = payload.get('user_id', current_user.id)
    if payload.get('is_global'):
        user_id = None
    if user_id is not None:
        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            raise HTTPException(400, 'Invalid user_id')

    data = payload.get('data')
    if isinstance(data, (dict, list)):
        data = json.dumps(data)
    if data is not None and not isinstance(data, str):
        data = str(data)

    ntype = payload.get('type')
    notification = crud.create_notification(db, user_id=user_id, title=title, message=message, data=data, ntype=ntype)
    await manager.emit_notification(notification)
    return serialize_notification(notification)
