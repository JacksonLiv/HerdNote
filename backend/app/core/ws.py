import asyncio
from collections import defaultdict

from fastapi import WebSocket

# In-process pub/sub: engagement_id (str) -> connected sockets.
# Single-instance only; Redis fan-out is the documented future scale path.


class EngagementHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def join(self, engagement_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._rooms[engagement_id].add(ws)

    async def leave(self, engagement_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._rooms.get(engagement_id, set()).discard(ws)

    async def broadcast(self, engagement_id: str, message: dict) -> None:
        async with self._lock:
            targets = list(self._rooms.get(engagement_id, set()))
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._rooms.get(engagement_id, set()).discard(ws)


hub = EngagementHub()
