"""
Chat Router
============
Main chat endpoint and chat history retrieval.
Chat works both authenticated and anonymously.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_optional_user
from app.models import User
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ChatHistoryResponse,
    ChatHistoryItem,
)
from app.services.chat_service import process_chat_message, get_chat_history

logger = logging.getLogger("chatbot")

router = APIRouter(prefix="/chat", tags=["💬 Chat"])


@router.post(
    "",
    response_model=ChatResponse,
    summary="Send Chat Message",
    description=(
        "Send a message to the chatbot.\n\n"
        "**Two modes:**\n"
        "1. **Personal data query** (schedule, grades, profile) → requires login\n"
        "2. **General knowledge Q&A** → uses AI (works without login)\n\n"
        "The bot automatically detects the intent from your message."
    ),
)
def chat(
    request: ChatRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Process a chat message.

    - If the message is about personal data and user is not logged in → asks to login.
    - If logged in → returns the relevant student data.
    - If general question → routes to AI (or mock AI).
    """
    logger.info(
        f"Chat received: user={'authenticated' if user else 'anonymous'}, "
        f"message_length={len(request.message)}"
    )

    response = process_chat_message(
        message=request.message,
        user=user,
        session_id=request.session_id,
        db=db,
    )

    logger.info(f"Chat response: intent={response.intent}, requires_login={response.requires_login}")
    return response


@router.get(
    "/history",
    response_model=ChatHistoryResponse,
    summary="Get Chat History",
    description="Retrieve chat history for the authenticated user. Supports pagination.",
)
def chat_history(
    limit: int = Query(50, ge=1, le=200, description="Maximum messages to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the authenticated user's chat history.
    Messages are ordered by most recent first.
    """
    logger.info(
        f"Fetching chat history: user={current_user.student_id}, "
        f"limit={limit}, offset={offset}"
    )

    total, messages = get_chat_history(
        db=db,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )

    return ChatHistoryResponse(
        total=total,
        history=[ChatHistoryItem.model_validate(msg) for msg in messages],
    )
