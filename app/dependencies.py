"""
Shared Dependencies
===================
FastAPI dependency functions used across multiple routers.
"""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.utils.jwt_handler import verify_token

logger = logging.getLogger("chatbot")

# ---------------------------------------------------------------------------
# Security scheme — extracts Bearer token from Authorization header
# ---------------------------------------------------------------------------
security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency: Extracts and validates JWT token, returns the User.
    Raises 401 if token is missing, invalid, or expired.
    """
    if credentials is None:
        logger.warning("Authentication failed: no credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vui lòng đăng nhập để sử dụng tính năng này. (Please login to use this feature.)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = verify_token(token)

    if payload is None:
        logger.warning("Authentication failed: invalid or expired token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn. (Invalid or expired token.)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    student_id: str = payload.get("sub")
    if student_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload invalid.",
        )

    # Look up user in database
    user = db.query(User).filter(User.student_id == student_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Không tìm thấy người dùng. (User not found.)",
        )

    return user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Dependency: Same as get_current_user but returns None instead of 401.
    Used for endpoints that work both authenticated and anonymously (e.g., /chat).
    """
    if credentials is None:
        return None

    token = credentials.credentials
    payload = verify_token(token)

    if payload is None:
        return None

    student_id: str = payload.get("sub")
    if student_id is None:
        return None

    user = db.query(User).filter(User.student_id == student_id).first()
    return user
