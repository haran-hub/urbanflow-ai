from __future__ import annotations

import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, key: str):
        await websocket.accept()
        self.connections.setdefault(key, []).append(websocket)
        logger.info(f"WS connected: {key} (total: {self._total()})")

    def disconnect(self, websocket: WebSocket, key: str):
        if key in self.connections:
            try:
                self.connections[key].remove(websocket)
            except ValueError:
                pass
            if not self.connections[key]:
                del self.connections[key]
        logger.info(f"WS disconnected: {key} (total: {self._total()})")

    async def broadcast_to_city(self, city: str, payload: dict):
        await self._send_to_key(f"city:{city}", payload)

    async def broadcast(self, payload: dict):
        dead = []
        for key, conns in self.connections.items():
            for ws in list(conns):
                try:
                    await ws.send_json(payload)
                except Exception:
                    dead.append((key, ws))
        for key, ws in dead:
            self.disconnect(ws, key)

    async def _send_to_key(self, key: str, payload: dict):
        dead = []
        for ws in list(self.connections.get(key, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, key)

    def _total(self):
        return sum(len(v) for v in self.connections.values())


manager = ConnectionManager()
