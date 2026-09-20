"""In-process TTL cache for reflected schema metadata and graphs."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from app.config import settings
from app.core.schema.graph import SchemaGraph


@dataclass
class _CacheEntry:
    metadata: List[dict]
    graph: SchemaGraph
    expires_at: float


class SchemaMemoryCache:
    def __init__(self, ttl_seconds: float) -> None:
        self._ttl_seconds = ttl_seconds
        self._entries: Dict[int, _CacheEntry] = {}
        self._lock = threading.Lock()

    def get(self, connection_id: int) -> Optional[Tuple[List[dict], SchemaGraph]]:
        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(connection_id)
            if not entry:
                return None
            if entry.expires_at <= now:
                del self._entries[connection_id]
                return None
            return entry.metadata, entry.graph

    def set(self, connection_id: int, metadata: List[dict], graph: SchemaGraph) -> None:
        with self._lock:
            self._entries[connection_id] = _CacheEntry(
                metadata=metadata,
                graph=graph,
                expires_at=time.monotonic() + self._ttl_seconds,
            )

    def invalidate(self, connection_id: int) -> None:
        with self._lock:
            self._entries.pop(connection_id, None)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


schema_memory_cache = SchemaMemoryCache(settings.SCHEMA_CACHE_TTL_SECONDS)
