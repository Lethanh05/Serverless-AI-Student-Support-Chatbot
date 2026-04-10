"""
Student Router
==============
Endpoints for student data (schedule and profile).
All endpoints require authentication.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.models import User
from app.schemas import ScheduleResponse, ProfileResponse
from app.services.portal_service import get_student_schedule, get_student_profile

logger = logging.getLogger("chatbot")

router = APIRouter(prefix="/student", tags=["🎓 Student Data"])


@router.get(
    "/schedule",
    response_model=ScheduleResponse,
    summary="Get Student Schedule",
    description="Returns the authenticated student's class schedule for the current semester.",
)
def get_schedule(current_user: User = Depends(get_current_user)):
    """
    Fetch the current student's schedule from the mock portal.
    Requires authentication.
    """
    logger.info(f"Fetching schedule for student_id={current_user.student_id}")

    schedule = get_student_schedule(current_user.student_id)
    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Không tìm thấy lịch học. Vui lòng thử lại sau. "
                "(Schedule not found. Please try again later.)"
            ),
        )

    return schedule


@router.get(
    "/profile",
    response_model=ProfileResponse,
    summary="Get Student Profile",
    description="Returns the authenticated student's profile information.",
)
def get_profile(current_user: User = Depends(get_current_user)):
    """
    Fetch the current student's profile from the mock portal.
    Requires authentication.
    """
    logger.info(f"Fetching profile for student_id={current_user.student_id}")

    profile = get_student_profile(current_user.student_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Không tìm thấy hồ sơ sinh viên. Vui lòng thử lại sau. "
                "(Profile not found. Please try again later.)"
            ),
        )

    return profile
