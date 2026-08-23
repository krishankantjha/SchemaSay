import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.token import RefreshToken, RevokedToken
from app.schemas.auth import UserCreate, UserResponse, Token, UserLogin, TokenRefreshRequest
from app.core.auth.hashing import hash_password, verify_password
from app.core.auth.jwt import create_access_token, decode_access_token
from app.utils.rate_limiter import login_limiter, register_limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _cleanup_expired_tokens(db: Session) -> None:
    now = datetime.now(timezone.utc)
    db.query(RefreshToken).filter(RefreshToken.expires_at < now).delete(synchronize_session=False)
    db.query(RevokedToken).filter(RevokedToken.expires_at < now).delete(synchronize_session=False)

# Define the OAuth2 security scheme for extracting JWT tokens from request headers
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Dependency that extracts, decodes, and validates the access token.
    Checks the JTI claims database blacklist and ensures the user account is active.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    email = payload.get("sub")
    jti = payload.get("jti")
    if email is None or jti is None:
        raise credentials_exception
        
    # Query database to confirm token has not been blacklisted
    is_revoked = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
    if is_revoked:
        raise credentials_exception
        
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
        
    # Restrict inactive user accesses
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
        
    return user

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(request: Request, user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new platform user.
    Enforces IP-based rate limits and returns 409 Conflict for duplicate emails.
    """
    # Check registration rate limits
    client_ip = request.client.host if request.client else "unknown"
    if register_limiter.check_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please try again later."
        )

    # Validate email uniqueness
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists"
        )
    
    # Create the new user record
    new_user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
def login(request: Request, credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticates user credentials.
    Implements IP-based rate limiting, brute-force tracking, and lockouts.
    """
    # Check authentication rate limits
    client_ip = request.client.host if request.client else "unknown"
    if login_limiter.check_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Please try again later."
        )

    user = db.query(User).filter(User.email == credentials.email).first()
    
    if user:
        # Check brute-force account lockout duration
        if user.locked_until:
            locked_until_utc = user.locked_until.replace(tzinfo=timezone.utc) if user.locked_until.tzinfo is None else user.locked_until
            if locked_until_utc > datetime.now(timezone.utc):
                seconds_left = int((locked_until_utc - datetime.now(timezone.utc)).total_seconds())
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Account is locked due to too many failed attempts. Try again in {seconds_left} seconds."
                )
            else:
                # Lockout period expired
                user.locked_until = None
                db.commit()

    # Verify matching credentials
    if not user or not verify_password(credentials.password, user.hashed_password):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
                user.failed_login_attempts = 0
            db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Reset authentication failures upon success
    user.failed_login_attempts = 0
    user.locked_until = None
    
    # Generate token payload
    access_token = create_access_token(data={"sub": user.email})
    refresh_token_str = secrets.token_hex(32)
    
    _cleanup_expired_tokens(db)
    db_refresh_token = RefreshToken(
        token_hash=_hash_refresh_token(refresh_token_str),
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(db_refresh_token)
    db.commit()
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "token_type": "bearer"
    }

@router.post("/refresh", response_model=Token)
def refresh(payload: TokenRefreshRequest, db: Session = Depends(get_db)):
    """
    Rotates the session by consuming a valid refresh token and issuing new pairs.
    """
    _cleanup_expired_tokens(db)
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token_hash == _hash_refresh_token(payload.refresh_token)
    ).first()
    
    # Verify token existence, status, and expiration
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
        
    if db_token.revoked:
        # Security Event: Token reuse detected. Revoke all active refresh tokens for this user.
        db.query(RefreshToken).filter(
            RefreshToken.user_id == db_token.user_id
        ).update({"revoked": True})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Security warning: Session compromise detected. Please log in again."
        )
        
    expires_at_utc = db_token.expires_at.replace(tzinfo=timezone.utc) if db_token.expires_at.tzinfo is None else db_token.expires_at
    if expires_at_utc < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or disabled"
        )

    # Consume the token atomically. A concurrent request must not be able to
    # consume the same refresh token twice.
    consumed = db.query(RefreshToken).filter(
        RefreshToken.id == db_token.id,
        RefreshToken.revoked.is_(False),
    ).update({"revoked": True}, synchronize_session=False)
    if consumed != 1:
        db.rollback()
        db.query(RefreshToken).filter(RefreshToken.user_id == db_token.user_id).update({"revoked": True})
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token reuse detected")

    # Create new credentials set
    new_access_token = create_access_token(data={"sub": user.email})
    new_refresh_token_str = secrets.token_hex(32)
    
    new_db_token = RefreshToken(
        token_hash=_hash_refresh_token(new_refresh_token_str),
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(new_db_token)
    db.commit()

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token_str,
        "token_type": "bearer"
    }

@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Blacklists the active access token's JTI claim and revokes active refresh tokens.
    """
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
        
    jti = payload.get("jti")
    exp = payload.get("exp")
    email = payload.get("sub")
    
    if not jti or not exp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims"
        )

    # Save JTI to blacklist idempotently
    exp_datetime = datetime.fromtimestamp(exp, timezone.utc)
    if not db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
        db.add(RevokedToken(jti=jti, expires_at=exp_datetime))
    _cleanup_expired_tokens(db)
    
    # Terminate active user sessions
    user = db.query(User).filter(User.email == email).first()
    if user:
        db.query(RefreshToken).filter(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked.is_(False)
        ).update({"revoked": True})

    db.commit()
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the profile information of the currently authenticated user.
    """
    return current_user
