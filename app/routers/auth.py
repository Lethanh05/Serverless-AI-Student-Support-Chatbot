"""
Auth Router
===========
Handles authentication endpoints: login and current user info.
"""

import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import LoginRequest, TokenResponse, UserResponse
from app.dependencies import get_current_user
from app.models import User
from app.services.auth_service import authenticate_user
from app.utils.jwt_handler import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

logger = logging.getLogger("chatbot")

router = APIRouter(prefix="/auth", tags=["🔐 Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login (Mock UTH Portal)",
    description=(
        "Authenticate with student credentials. "
        "Returns a JWT access token on success.\n\n"
        "**Mock accounts for testing:**\n"
        "- `20110001` / `password123` (Nguyễn Văn An)\n"
        "- `20110002` / `password123` (Trần Thị Bình)\n"
        "- `20110003` / `password123` (Lê Hoàng Cường)"
    ),
)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a student and issue a JWT token.
    """
    logger.info(f"Login attempt: student_id={request.student_id}")

    # Verify credentials against mock portal
    user = authenticate_user(db, request.student_id, request.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sai mã sinh viên hoặc mật khẩu. (Invalid student ID or password.)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create JWT token with student_id as subject
    access_token = create_access_token(
        data={"sub": user.student_id, "name": user.full_name},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Convert to seconds
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get Current User",
    description="Returns the profile of the currently authenticated user.",
)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Get the authenticated user's information.
    Requires a valid Bearer token in the Authorization header.
    """
    logger.info(f"Fetching user info: student_id={current_user.student_id}")
    return current_user
