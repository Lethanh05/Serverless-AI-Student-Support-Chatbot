"""
AI Service
==========
Handles communication with OpenAI API for general knowledge Q&A.
Falls back to mock responses when OPENAI_API_KEY is not set.
"""

import os
import logging
from typing import Optional

logger = logging.getLogger("chatbot")

# ---------------------------------------------------------------------------
# OpenAI API key — read from environment
# ---------------------------------------------------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


def get_ai_response(user_message: str, context: Optional[str] = None) -> str:
    """
    Get a response from the AI for general knowledge questions.

    Strategy:
        1. If OPENAI_API_KEY is available → call OpenAI API
        2. If no key → return a helpful mock response

    Args:
        user_message: The user's question.
        context: Optional additional context to include in the prompt.

    Returns:
        AI-generated response string.
    """
    if OPENAI_API_KEY:
        return _call_openai(user_message, context)
    else:
        logger.info("No OPENAI_API_KEY set — returning mock AI response")
        return _get_mock_response(user_message)


def _call_openai(user_message: str, context: Optional[str] = None) -> str:
    """
    Call the OpenAI ChatCompletion API.
    """
    try:
        from openai import OpenAI

        client = OpenAI(api_key=OPENAI_API_KEY)

        # Build the system prompt
        system_prompt = (
            "Bạn là trợ lý ảo thông minh của trường Đại học Giao thông Vận tải TP.HCM (UTH). "
            "Hãy trả lời câu hỏi một cách chính xác, thân thiện và súc tích. "
            "Trả lời bằng tiếng Việt nếu câu hỏi bằng tiếng Việt, "
            "và bằng tiếng Anh nếu câu hỏi bằng tiếng Anh."
        )

        messages = [{"role": "system", "content": system_prompt}]

        # Add optional context
        if context:
            messages.append({
                "role": "system",
                "content": f"Additional context:\n{context}",
            })

        messages.append({"role": "user", "content": user_message})

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=1024,
            temperature=0.7,
        )

        reply = response.choices[0].message.content.strip()
        logger.info(f"OpenAI response received (length={len(reply)})")
        return reply

    except Exception as e:
        logger.error(f"OpenAI API error: {str(e)}")
        return (
            "⚠️ Xin lỗi, hệ thống AI đang gặp sự cố. "
            "Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ. "
            "(AI service is temporarily unavailable. Please try again later.)"
        )


def _get_mock_response(user_message: str) -> str:
    """
    Return a mock AI response when no API key is configured.
    Provides some basic keyword-based replies for demonstration.
    """
    text = user_message.lower()

    # Mock responses for common questions
    mock_responses = {
        "hello": "Xin chào! 👋 Tôi là trợ lý ảo UTH. Tôi có thể giúp bạn tra cứu thông tin sinh viên hoặc trả lời các câu hỏi chung. Bạn cần giúp gì?",
        "xin chào": "Xin chào! 👋 Tôi là trợ lý ảo UTH. Tôi có thể giúp bạn tra cứu thông tin sinh viên hoặc trả lời các câu hỏi chung. Bạn cần giúp gì?",
        "uth": "🏫 Trường Đại học Giao thông Vận tải TP.HCM (UTH) là một trong những trường đại học hàng đầu về đào tạo kỹ thuật và công nghệ tại Việt Nam. Trường có nhiều chương trình đào tạo đa dạng từ kỹ thuật, công nghệ thông tin đến kinh tế.",
        "học phí": "💰 Thông tin học phí tham khảo (mock):\n- Chương trình đại trà: ~15-20 triệu VNĐ/năm\n- Chương trình chất lượng cao: ~25-35 triệu VNĐ/năm\nVui lòng liên hệ Phòng Đào tạo để biết chi tiết.",
        "tuyển sinh": "📋 Thông tin tuyển sinh UTH (mock):\n- Xét tuyển bằng điểm thi THPT Quốc gia\n- Xét tuyển học bạ\n- Xét tuyển bằng đánh giá năng lực\nThời gian nộp hồ sơ: tháng 4 - tháng 8 hàng năm.",
    }

    for keyword, response in mock_responses.items():
        if keyword in text:
            return response

    # Default mock response
    return (
        "🤖 [Chế độ Mock] Cảm ơn bạn đã hỏi! "
        f"Câu hỏi của bạn: \"{user_message}\"\n\n"
        "Hiện tại hệ thống AI đang chạy ở chế độ mock (không có OPENAI_API_KEY). "
        "Để nhận câu trả lời thực từ AI, vui lòng cấu hình biến môi trường OPENAI_API_KEY.\n\n"
        "Bạn vẫn có thể sử dụng các tính năng tra cứu thông tin cá nhân (lịch học, điểm, hồ sơ) "
        "bằng cách đăng nhập trước."
    )
