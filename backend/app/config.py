import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables and .env file.
    Provides type validation and fail-fast checks on startup.
    """
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # Default: 15 minutes. Override via ACCESS_TOKEN_EXPIRE_MINUTES in .env
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # AI provider API keys — both are optional. If neither is set, the heuristic offline compiler is used instead.
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    # auto = Gemini then OpenAI (whichever keys are present). Override with openai or gemini.
    LLM_PROVIDER: str = "auto"
    OPENAI_MODEL: str = "gpt-4o-mini"
    GEMINI_MODEL: str = "gemini-3.6-flash"
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    LLM_TIMEOUT_SECONDS: float = 20.0
    
    # Fernet symmetric encryption key for storing database credentials. Generate with: Fernet.generate_key()
    ENCRYPTION_KEY: str
    
    # Allowed origins for CORS (comma-separated string)
    ALLOWED_ORIGINS: str = "http://localhost:8501,http://127.0.0.1:8501,http://localhost:3000,http://localhost:5173"

    # Google OAuth (optional — required only for Google sign-in)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"
    FRONTEND_URL: str = "http://localhost:5173"

    # Query pipeline controls
    BLOCK_ON_GROUNDING_FAILURE: bool = True
    MIN_CONFIDENCE_TO_EXECUTE: int = 0

    # Schema profiling limits (used during sync when profile=true)
    SCHEMA_PROFILE_MAX_TABLES: int = 25
    SCHEMA_PROFILE_SAMPLE_ROWS: int = 1000
    SCHEMA_PROFILE_NULL_WARNING_THRESHOLD: float = 0.2

    # Semantic metric resolution
    SEMANTIC_METRIC_MATCH_THRESHOLD: float = 3.0

    # Learning loop retrieval
    LEARNING_MAX_EXAMPLES: int = 3
    LEARNING_MIN_SIMILARITY: float = 0.2
    LEARNING_DIRECT_MATCH_THRESHOLD: float = 0.75

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        extra="ignore"
    )

settings = Settings()
