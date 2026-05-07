from typing import Dict, List
import json
from fastapi import WebSocket
from .models import Notification


def serialize_notification(notification: Notification) -> dict:
    data = notification.data
    if isinstance(data, str) and data:
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            data = notification.data

    return {
        "id": notification.id,
        "title": notification.title,
        "message": notification.message,
        "data": data,
        "type": notification.type,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat(),
    }


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        sockets = self.active_connections.get(user_id, [])
        if websocket in sockets:
            sockets.remove(websocket)
        if not sockets:
            self.active_connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        sockets = list(self.active_connections.get(user_id, []))
        for socket in sockets:
            await socket.send_json(payload)

    async def send_to_all(self, payload: dict) -> None:
        for user_id in list(self.active_connections.keys()):
            await self.send_to_user(user_id, payload)

    async def emit_notification(self, notification: Notification) -> None:
        payload = {
            "type": "notification",
            "notification": serialize_notification(notification),
        }
        if notification.user_id is None:
            await self.send_to_all(payload)
            return
        await self.send_to_user(notification.user_id, payload)


manager = ConnectionManager()
