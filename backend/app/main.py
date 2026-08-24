import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.routes import assistant, auth, connections, insights, query, schema
from app.config import settings
from app.database import engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("schemasay")

app = FastAPI(
    title="SchemaSay API",
    description="The backend engine for SchemaSay AI",
    version="1.0.0",
)

origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault("Content-Security-Policy", "default-src 'self'; object-src 'none'; frame-ancestors 'none'")
    if request.url.scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


@app.on_event("startup")
def startup_checks():
    """Perform non-mutating startup checks; schema changes belong to Alembic deployment steps."""
    logger.info("Initializing SchemaSay API Engine startup checks...")
    if not settings.OPENAI_API_KEY and not settings.GEMINI_API_KEY:
        logger.info("No LLM provider configured; heuristic/offline mode is active")
    if not settings.REDIS_URL:
        logger.warning("REDIS_URL is not configured; rate limits are process-local")
    logger.info("Startup checks completed")


@app.exception_handler(Exception)
def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled system exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": "An internal server error occurred."})


app.include_router(auth.router, prefix="/api/v1")
app.include_router(connections.router, prefix="/api/v1")
app.include_router(schema.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
app.include_router(query.router, prefix="/api/v1")
app.include_router(insights.router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {"message": "Welcome to the SchemaSay API"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/ready")
def readiness_check():
    """Verify the metadata database is reachable without exposing connection details."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        logger.exception("Readiness check failed")
        return JSONResponse(status_code=503, content={"status": "not_ready"})
