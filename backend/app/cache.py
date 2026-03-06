"""
Simple in-memory TTL cache shared across the app.
No external dependency — just a dict + timestamps.
"""
import time
from typing import Any


class TTLCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        val, exp = entry
        if time.time() < exp:
            return val
        del self._store[key]
        return None

    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        self._store[key] = (value, time.time() + ttl)

    def cleanup(self) -> None:
        now = time.time()
        self._store = {k: v for k, v in self._store.items() if v[1] > now}


# Shared singletons
ai_cache = TTLCache()   # prediction / recommendation / best-time responses
ctx_cache = TTLCache()  # concierge _build_rich_context per city
