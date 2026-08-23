from datetime import datetime
import re
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

class UserCreate(BaseModel):
    """
    Validation schema for incoming registration requests.
    Enforces valid email format and strong password complexity rules.
    """
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=128)

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """
        Validates password strength:
        - Minimum 8 characters
        - At least 1 uppercase letter
        - At least 1 lowercase letter
        - At least 1 digit
        - At least 1 special character
        """
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v

class UserResponse(BaseModel):
    """
    Serialization schema for outgoing user profile responses.
    Filters out password attributes to prevent credential exposure.
    """
    id: int
    email: EmailStr
    full_name: Optional[str]
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    """
    Validation schema for incoming login requests.
    """
    email: EmailStr
    password: str = Field(..., max_length=128)

class Token(BaseModel):
    """
    Structure of the JWT response payload returned on successful login.
    """
    access_token: str
    refresh_token: str
    token_type: str

class TokenRefreshRequest(BaseModel):
    """
    Validation schema for requesting access token renewal using a refresh token.
    """
    refresh_token: str

class TokenData(BaseModel):
    """
    Structure of the decoded JWT token payload.
    """
    email: Optional[str] = None
    jti: Optional[str] = None
