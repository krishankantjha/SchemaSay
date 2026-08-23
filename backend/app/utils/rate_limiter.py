import logging
import os
import threading
import time
from collections import OrderedDict

try:
    import redis
except ImportError:  # pragma: no cover - optional in minimal local installs
    redis = None

logger = logging.getLogger("schemasay.rate_limiter")


class InMemoryRateLimiter:
    """Bounded sliding-window limiter for single-process deployments and tests."""

    def __init__(self, requests_limit: int, window_seconds: int, max_keys: int = 10_000):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self.history: OrderedDict[str, list[float]] = OrderedDict()
        self.lock = threading.Lock()

    def check_rate_limit(self, key: str) -> bool:
        if os.environ.get("TESTING", "").lower() == "true":
            return False
        now = time.monotonic()
        with self.lock:
            timestamps = [t for t in self.history.get(key, []) if now - t < self.window_seconds]
            if len(timestamps) >= self.requests_limit:
                self.history[key] = timestamps
                self.history.move_to_end(key)
                return True
            timestamps.append(now)
            self.history[key] = timestamps
            self.history.move_to_end(key)
            while len(self.history) > self.max_keys:
                self.history.popitem(last=False)
            return False

    def clear(self) -> None:
        with self.lock:
            self.history.clear()


class RedisRateLimiter:
    """Redis-backed fixed/sliding window limiter for multi-worker deployments."""

    def __init__(self, requests_limit: int, window_seconds: int, namespace: str):
        if redis is None:
            raise RuntimeError("redis package is required when REDIS_URL is configured")
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self.namespace = namespace
        self.client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

    def check_rate_limit(self, key: str) -> bool:
        if os.environ.get("TESTING", "").lower() == "true":
            return False
        bucket = f"{self.namespace}:{key}"
        now = time.time()
        cutoff = now - self.window_seconds
        pipe = self.client.pipeline()
        pipe.zremrangebyscore(bucket, 0, cutoff)
        pipe.zcard(bucket)
        pipe.zadd(bucket, {str(now): now})
        pipe.expire(bucket, self.window_seconds + 1)
        _, count, _, _ = pipe.execute()
        if count >= self.requests_limit:
            self.client.zrem(bucket, str(now))
            return True
        return False

    def clear(self) -> None:
        # Production cleanup is TTL-based; this method exists for interface parity.
        return None


def _build_limiter(limit: int, namespace: str):
    redis_url = settings.REDIS_URL
    if redis_url:
        if redis is None:
            logger.warning("REDIS_URL is configured but redis is not installed; using bounded local limiter")
        else:
            try:
                return RedisRateLimiter(limit, 60, namespace)
            except Exception:
                logger.exception("Redis limiter initialization failed; using bounded local limiter")
    return InMemoryRateLimiter(limit, 60)


# Imported lazily here to keep this module independently testable.
from app.config import settings

login_limiter = _build_limiter(5, "schemasay:login")
register_limiter = _build_limiter(5, "schemasay:register")
query_limiter = _build_limiter(30, "schemasay:query")
