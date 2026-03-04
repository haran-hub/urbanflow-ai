from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket_manager import manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/city/{city}")
async def city_websocket(websocket: WebSocket, city: str):
    """Real-time updates for all entities in a city."""
    await manager.connect(websocket, f"city:{city}")
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping
    except WebSocketDisconnect:
        manager.disconnect(websocket, f"city:{city}")


@router.websocket("/ws/session/{session_id}")
async def session_websocket(websocket: WebSocket, session_id: str):
    """Personalized real-time updates for a user session."""
    await manager.connect(websocket, f"session:{session_id}")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, f"session:{session_id}")
