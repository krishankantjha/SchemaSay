import os
from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables and .env file.
    Provides type validation and fail-fast checks on startup.
    """
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "schemasay"
    JWT_AUDIENCE: str = "schemasay-api"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # Default: 15 minutes. Override via ACCESS_TOKEN_EXPIRE_MINUTES in .env
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # AI provider API keys — both are optional. If neither is set, the heuristic offline compiler is used instead.
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    
    # Fernet symmetric encryption key for storing database credentials. Generate with: Fernet.generate_key()
    ENCRYPTION_KEY: str
    
    # Allowed origins for CORS (comma-separated string)
    ALLOWED_ORIGINS: str = "http://localhost:8501,http://127.0.0.1:8501"

    # Connector security policy. Remote hosts are public-only unless explicitly allowlisted.
    ALLOWED_DB_HOSTS: str = ""
    REQUIRE_DB_HOST_ALLOWLIST: bool = True
    ALLOWED_SQLITE_ROOTS: str = ""
    SQLITE_DATA_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    TESTING: bool = False
    @field_validator("ALGORITHM")
    @classmethod
    def validate_algorithm(cls, value: str) -> str:
        if value != "HS256":
            raise ValueError("Only HS256 is supported for JWT signing")
        return value

    @field_validator("SECRET_KEY", "ENCRYPTION_KEY")
    @classmethod
    def validate_secret_strength(cls, value: str) -> str:
        if not value or value.lower().startswith(("your-", "generate-")) or len(value) < 32:
            raise ValueError("Configured secrets must be generated, non-placeholder values of at least 32 characters")
        return value
    REDIS_URL: Optional[str] = None
    MAX_UPLOAD_BYTES: int = 10_000_000
    MAX_UPLOAD_ROWS: int = 100_000
    MAX_UPLOAD_COLUMNS: int = 100
    MAX_QUERY_ROWS: int = 10_000
    MAX_QUERY_COLUMNS: int = 200
    MAX_QUERY_CELL_BYTES: int = 32_768
    MAX_SCHEMA_ENTRIES: int = 20_000

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        extra="ignore"
    )

settings = Settings()
