"""
Intent Detection (Rule-Based)
==============================
Uses keyword matching to classify user messages into intents.
Supports both English and Vietnamese keywords.
"""

from typing import Tuple

# ---------------------------------------------------------------------------
# Intent categories
# ---------------------------------------------------------------------------
INTENT_SCHEDULE = "schedule"           # Asking about class schedule
INTENT_GRADES = "grades"              # Asking about grades / GPA
INTENT_PROFILE = "profile"            # Asking about personal profile
INTENT_PERSONAL = "personal"          # Generic personal data query
INTENT_GENERAL = "general"            # General knowledge question (→ AI)

# ---------------------------------------------------------------------------
# Keyword dictionaries for each personal intent
# ---------------------------------------------------------------------------
SCHEDULE_KEYWORDS = [
    # Vietnamese
    "lịch học", "thời khóa biểu", "tkb", "lịch thi",
    "môn học", "phòng học", "giờ học", "tiết học",
    # English
    "schedule", "timetable", "class schedule", "exam schedule",
    "classroom", "class time",
]

GRADES_KEYWORDS = [
    # Vietnamese
    "điểm", "điểm số", "gpa", "kết quả học tập",
    "điểm thi", "bảng điểm", "điểm trung bình",
    # English
    "grade", "grades", "score", "scores", "transcript",
    "academic result", "result",
]

PROFILE_KEYWORDS = [
    # Vietnamese
    "thông tin cá nhân", "hồ sơ", "mã sinh viên",
    "họ tên", "lớp", "khoa", "ngành",
    # English
    "profile", "personal info", "student id",
    "my name", "my class", "my faculty", "my major",
]

# Generic personal markers — phrases indicating the user is asking about THEIR data
PERSONAL_MARKERS = [
    # Vietnamese
    "của tôi", "của mình", "của em", "của tui",
    "tôi có", "em có", "mình có",
    # English
    "my ", "mine",
]


def detect_intent(message: str) -> Tuple[str, bool]:
    """
    Detect the intent of a user message using keyword matching.

    Args:
        message: The user's raw message text.

    Returns:
        Tuple of (intent_label, requires_auth).
        - intent_label: one of the INTENT_* constants
        - requires_auth: True if the user needs to be logged in
    """
    text = message.lower().strip()

    # ------------------------------------------------------------------
    # Step 1: Check for specific personal data intents
    # ------------------------------------------------------------------

    # Check schedule-related keywords
    for keyword in SCHEDULE_KEYWORDS:
        if keyword in text:
            return INTENT_SCHEDULE, True

    # Check grades-related keywords
    for keyword in GRADES_KEYWORDS:
        if keyword in text:
            return INTENT_GRADES, True

    # Check profile-related keywords
    for keyword in PROFILE_KEYWORDS:
        if keyword in text:
            return INTENT_PROFILE, True

    # ------------------------------------------------------------------
    # Step 2: Check for generic personal markers (e.g., "của tôi", "my")
    # ------------------------------------------------------------------
    for marker in PERSONAL_MARKERS:
        if marker in text:
            return INTENT_PERSONAL, True

    # ------------------------------------------------------------------
    # Step 3: Default to general knowledge question → routed to AI
    # ------------------------------------------------------------------
    return INTENT_GENERAL, False
