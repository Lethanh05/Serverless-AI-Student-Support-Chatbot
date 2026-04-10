"""
Chat Service
=============
Core chat logic — orchestrates intent detection, data retrieval, and AI responses.
Also manages chat history persistence.
"""

import logging
import uuid
from typing import Optional, List

from sqlalchemy.orm import Session

from app.models import User, ChatHistory
from app.schemas import ChatResponse
from app.utils.intent import (
    detect_intent,
    INTENT_SCHEDULE,
    INTENT_GRADES,
    INTENT_PROFILE,
    INTENT_PERSONAL,
    INTENT_GENERAL,
)
from app.services.portal_service import (
    get_student_schedule,
    get_student_profile,
    format_schedule_for_chat,
    format_profile_for_chat,
)
from app.services.ai_service import get_ai_response

logger = logging.getLogger("chatbot")


def process_chat_message(
    message: str,
    user: Optional[User],
    session_id: Optional[str],
    db: Session,
) -> ChatResponse:
    """
    Main chat processing pipeline.

    Logic:
        IF personal question:
            IF not logged in → return "Please login"
            ELSE → return student data
        ELSE:
            call AI API (or mock)

    Args:
        message: User's chat message.
        user: Authenticated User object, or None if anonymous.
        session_id: Optional session ID for grouping messages.
        db: Database session.

    Returns:
        ChatResponse with reply, intent, and metadata.
    """
    # Generate session_id if not provided
    if not session_id:
        session_id = str(uuid.uuid4())

    # ------------------------------------------------------------------
    # Step 1: Detect intent
    # ------------------------------------------------------------------
    intent, requires_auth = detect_intent(message)
    logger.info(f"Intent detected: intent={intent}, requires_auth={requires_auth}")

    # ------------------------------------------------------------------
    # Step 2: Save user message to history
    # ------------------------------------------------------------------
    _save_message(
        db=db,
        user_id=user.id if user else None,
        role="user",
        message=message,
        intent=intent,
        session_id=session_id,
    )

    # ------------------------------------------------------------------
    # Step 3: Generate response based on intent
    # ------------------------------------------------------------------
    reply: str
    login_required = False

    if requires_auth:
        # Personal data query — requires authentication
        if user is None:
            # User is NOT logged in
            reply = (
                "🔒 Bạn cần đăng nhập để xem thông tin cá nhân.\n"
                "Vui lòng sử dụng API /auth/login để đăng nhập trước.\n\n"
                "(Please login to access your personal data. "
                "Use the /auth/login endpoint first.)"
            )
            login_required = True
        else:
            # User IS logged in — fetch their data
            reply = _handle_personal_query(intent, user.student_id)
    else:
        # General knowledge question — route to AI
        reply = get_ai_response(message)

    # ------------------------------------------------------------------
    # Step 4: Save bot response to history
    # ------------------------------------------------------------------
    _save_message(
        db=db,
        user_id=user.id if user else None,
        role="assistant",
        message=reply,
        intent=intent,
        session_id=session_id,
    )

    return ChatResponse(
        reply=reply,
        intent=intent,
        requires_login=login_required,
        session_id=session_id,
    )


def _handle_personal_query(intent: str, student_id: str) -> str:
    """
    Handle personal data queries by fetching from the mock portal.
    """
    try:
        if intent == INTENT_SCHEDULE:
            schedule = get_student_schedule(student_id)
            if schedule:
                return format_schedule_for_chat(schedule)
            return "⚠️ Không tìm thấy lịch học. (Schedule not found.)"

        elif intent == INTENT_GRADES:
            # Grades are part of the profile in our mock
            profile = get_student_profile(student_id)
            if profile:
                return (
                    f"📊 Kết quả học tập:\n"
                    f"  📈 GPA: {profile['gpa']}\n"
                    f"  ✅ Tín chỉ tích lũy: {profile['credits_completed']}\n"
                    f"  📌 Trạng thái: {profile['status']}"
                )
            return "⚠️ Không tìm thấy thông tin điểm. (Grades not found.)"

        elif intent == INTENT_PROFILE:
            profile = get_student_profile(student_id)
            if profile:
                return format_profile_for_chat(profile)
            return "⚠️ Không tìm thấy hồ sơ sinh viên. (Profile not found.)"

        elif intent == INTENT_PERSONAL:
            # Generic personal query — return both profile and schedule
            profile = get_student_profile(student_id)
            schedule = get_student_schedule(student_id)
            parts = []
            if profile:
                parts.append(format_profile_for_chat(profile))
            if schedule:
                parts.append(format_schedule_for_chat(schedule))
            if parts:
                return "\n\n".join(parts)
            return "⚠️ Không tìm thấy dữ liệu. (No data found.)"

        else:
            return "⚠️ Không xác định được yêu cầu. (Could not determine your request.)"

    except Exception as e:
        logger.error(f"Portal service error: {str(e)}")
        return (
            "⚠️ Hệ thống cổng thông tin đang gặp sự cố. "
            "Vui lòng thử lại sau. "
            "(Portal service is temporarily unavailable.)"
        )


def get_chat_history(
    db: Session,
    user_id: int,
    limit: int = 50,
    offset: int = 0,
) -> tuple[int, List[ChatHistory]]:
    """
    Retrieve chat history for a specific user.

    Args:
        db: Database session.
        user_id: The user's ID.
        limit: Maximum number of messages to return.
        offset: Offset for pagination.

    Returns:
        Tuple of (total_count, list_of_messages).
    """
    total = db.query(ChatHistory).filter(ChatHistory.user_id == user_id).count()

    messages = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user_id)
        .order_by(ChatHistory.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return total, messages


def _save_message(
    db: Session,
    user_id: Optional[int],
    role: str,
    message: str,
    intent: str,
    session_id: str,
) -> ChatHistory:
    """
    Persist a chat message to the database.
    """
    chat_entry = ChatHistory(
        user_id=user_id,
        role=role,
        message=message,
        intent=intent,
        session_id=session_id,
    )
    db.add(chat_entry)
    db.commit()
    db.refresh(chat_entry)
    logger.debug(f"Saved chat message: role={role}, intent={intent}")
    return chat_entry
