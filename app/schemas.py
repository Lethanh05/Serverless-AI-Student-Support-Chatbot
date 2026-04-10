"""
Pydantic Schemas (Request / Response models)
=============================================
Separates API contract from database models.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# =====================================================================
# AUTH SCHEMAS
# =====================================================================

class LoginRequest(BaseModel):
    """POST /auth/login request body."""
    student_id: str = Field(..., example="20110001", description="Student ID from UTH portal")
    password: str = Field(..., example="password123", description="Student password")


class TokenResponse(BaseModel):
    """Response after successful login."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Token lifetime in seconds")


class UserResponse(BaseModel):
    """GET /auth/me response."""
    id: int
    student_id: str
    full_name: str
    email: str
    faculty: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2: enables ORM mode


# =====================================================================
# STUDENT SCHEMAS
# =====================================================================

class ScheduleItem(BaseModel):
    """A single class in the student's schedule."""
    subject: str
    subject_code: str
    teacher: str
    room: str
    day_of_week: str
    start_time: str
    end_time: str
    credits: int


class ScheduleResponse(BaseModel):
    """GET /student/schedule response."""
    student_id: str
    semester: str
    schedule: List[ScheduleItem]


class ProfileResponse(BaseModel):
    """GET /student/profile response."""
    student_id: str
    full_name: str
    email: str
    faculty: str
    major: str
    class_name: str
    academic_year: str
    gpa: float
    credits_completed: int
    status: str


# =====================================================================
# CHAT SCHEMAS
# =====================================================================

class ChatRequest(BaseModel):
    """POST /chat request body."""
    message: str = Field(..., min_length=1, max_length=2000, description="User's chat message")
    session_id: Optional[str] = Field(None, description="Optional session ID for grouping")


class ChatResponse(BaseModel):
    """POST /chat response."""
    reply: str
    intent: str
    requires_login: bool = False
    session_id: Optional[str] = None


class ChatHistoryItem(BaseModel):
    """Single chat history entry."""
    id: int
    role: str
    message: str
    intent: Optional[str] = None
    session_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    """GET /chat/history response."""
    total: int
    history: List[ChatHistoryItem]


# =====================================================================
# GENERIC SCHEMAS
# =====================================================================

class ErrorResponse(BaseModel):
    """Standard error response."""
    detail: str
    error_code: Optional[str] = None
