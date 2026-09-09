from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings


def _build_engine():
    """Build a dialect-compatible metadata engine."""
    if settings.DATABASE_URL.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
        kwargs = {"connect_args": connect_args}
        if ":memory:" in settings.DATABASE_URL:
            kwargs["poolclass"] = StaticPool
        return create_engine(settings.DATABASE_URL, **kwargs)

    return create_engine(
        settings.DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_pre_ping=True,
    )


engine = _build_engine()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    """Yield a request-scoped metadata session with rollback-on-error semantics."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
