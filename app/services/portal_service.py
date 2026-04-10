"""
Portal Service (Mock)
=====================
Simulates the UTH student portal API.
Returns mock data for schedule and profile — NO real API calls.
"""

import logging
from typing import Optional

logger = logging.getLogger("chatbot")


# ===========================================================================
# MOCK SCHEDULE DATA
# ===========================================================================
MOCK_SCHEDULES = {
    "20110001": {
        "student_id": "20110001",
        "semester": "Học kỳ 2 - 2025-2026",
        "schedule": [
            {
                "subject": "Trí tuệ Nhân tạo",
                "subject_code": "CS401",
                "teacher": "PGS.TS Nguyễn Thanh Tùng",
                "room": "A301",
                "day_of_week": "Thứ 2",
                "start_time": "07:30",
                "end_time": "09:30",
                "credits": 3,
            },
            {
                "subject": "Phát triển Ứng dụng Web",
                "subject_code": "CS305",
                "teacher": "TS. Trần Minh Đức",
                "room": "B205",
                "day_of_week": "Thứ 3",
                "start_time": "09:45",
                "end_time": "11:45",
                "credits": 3,
            },
            {
                "subject": "Cơ sở Dữ liệu Nâng cao",
                "subject_code": "CS310",
                "teacher": "TS. Phạm Thị Hoa",
                "room": "A102",
                "day_of_week": "Thứ 4",
                "start_time": "13:00",
                "end_time": "15:00",
                "credits": 3,
            },
            {
                "subject": "Mạng Máy tính",
                "subject_code": "CS303",
                "teacher": "ThS. Lê Văn Hùng",
                "room": "C401",
                "day_of_week": "Thứ 5",
                "start_time": "07:30",
                "end_time": "09:30",
                "credits": 3,
            },
            {
                "subject": "Đồ án Chuyên ngành",
                "subject_code": "CS490",
                "teacher": "PGS.TS Nguyễn Thanh Tùng",
                "room": "Lab A3",
                "day_of_week": "Thứ 6",
                "start_time": "13:00",
                "end_time": "16:00",
                "credits": 3,
            },
        ],
    },
    "20110002": {
        "student_id": "20110002",
        "semester": "Học kỳ 2 - 2025-2026",
        "schedule": [
            {
                "subject": "Machine Learning",
                "subject_code": "CS402",
                "teacher": "PGS.TS Lê Quang Vinh",
                "room": "A201",
                "day_of_week": "Thứ 2",
                "start_time": "09:45",
                "end_time": "11:45",
                "credits": 3,
            },
            {
                "subject": "Xử lý Ngôn ngữ Tự nhiên",
                "subject_code": "CS410",
                "teacher": "TS. Hoàng Minh Tuấn",
                "room": "B301",
                "day_of_week": "Thứ 4",
                "start_time": "07:30",
                "end_time": "09:30",
                "credits": 3,
            },
            {
                "subject": "An toàn Thông tin",
                "subject_code": "CS350",
                "teacher": "TS. Đỗ Hải Nam",
                "room": "C201",
                "day_of_week": "Thứ 6",
                "start_time": "13:00",
                "end_time": "15:00",
                "credits": 3,
            },
        ],
    },
    "20110003": {
        "student_id": "20110003",
        "semester": "Học kỳ 2 - 2025-2026",
        "schedule": [
            {
                "subject": "Kiểm thử Phần mềm",
                "subject_code": "SE301",
                "teacher": "ThS. Võ Thanh Hải",
                "room": "A105",
                "day_of_week": "Thứ 3",
                "start_time": "07:30",
                "end_time": "09:30",
                "credits": 3,
            },
            {
                "subject": "Quản lý Dự án Phần mềm",
                "subject_code": "SE402",
                "teacher": "TS. Nguyễn Hữu Phúc",
                "room": "B102",
                "day_of_week": "Thứ 5",
                "start_time": "09:45",
                "end_time": "11:45",
                "credits": 3,
            },
        ],
    },
}


# ===========================================================================
# MOCK PROFILE DATA
# ===========================================================================
MOCK_PROFILES = {
    "20110001": {
        "student_id": "20110001",
        "full_name": "Nguyễn Văn An",
        "email": "an.nguyen@student.uth.edu.vn",
        "faculty": "Công nghệ Thông tin",
        "major": "Khoa học Máy tính",
        "class_name": "DHKTPM16A",
        "academic_year": "2021-2025",
        "gpa": 3.45,
        "credits_completed": 120,
        "status": "Đang học",
    },
    "20110002": {
        "student_id": "20110002",
        "full_name": "Trần Thị Bình",
        "email": "binh.tran@student.uth.edu.vn",
        "faculty": "Khoa học Máy tính",
        "major": "Trí tuệ Nhân tạo",
        "class_name": "DHKTPM16B",
        "academic_year": "2021-2025",
        "gpa": 3.78,
        "credits_completed": 125,
        "status": "Đang học",
    },
    "20110003": {
        "student_id": "20110003",
        "full_name": "Lê Hoàng Cường",
        "email": "cuong.le@student.uth.edu.vn",
        "faculty": "Kỹ thuật Phần mềm",
        "major": "Kỹ thuật Phần mềm",
        "class_name": "DHKTPM16C",
        "academic_year": "2021-2025",
        "gpa": 3.12,
        "credits_completed": 110,
        "status": "Đang học",
    },
}


def get_student_schedule(student_id: str) -> Optional[dict]:
    """
    Fetch student schedule from mock portal.

    Args:
        student_id: The student's ID.

    Returns:
        Schedule dict if found, None otherwise.
    """
    schedule = MOCK_SCHEDULES.get(student_id)
    if schedule is None:
        logger.warning(f"Portal: schedule not found for student_id={student_id}")
    else:
        logger.info(f"Portal: fetched schedule for student_id={student_id}")
    return schedule


def get_student_profile(student_id: str) -> Optional[dict]:
    """
    Fetch student profile from mock portal.

    Args:
        student_id: The student's ID.

    Returns:
        Profile dict if found, None otherwise.
    """
    profile = MOCK_PROFILES.get(student_id)
    if profile is None:
        logger.warning(f"Portal: profile not found for student_id={student_id}")
    else:
        logger.info(f"Portal: fetched profile for student_id={student_id}")
    return profile


def format_schedule_for_chat(schedule_data: dict) -> str:
    """
    Format schedule data into a readable chat message.
    """
    lines = [f"📅 Lịch học {schedule_data['semester']}:\n"]
    for i, item in enumerate(schedule_data["schedule"], 1):
        lines.append(
            f"  {i}. {item['subject']} ({item['subject_code']})\n"
            f"     📍 Phòng: {item['room']} | 🕐 {item['day_of_week']} {item['start_time']}-{item['end_time']}\n"
            f"     👨‍🏫 GV: {item['teacher']} | Tín chỉ: {item['credits']}"
        )
    return "\n".join(lines)


def format_profile_for_chat(profile_data: dict) -> str:
    """
    Format profile data into a readable chat message.
    """
    return (
        f"👤 Thông tin sinh viên:\n"
        f"  📛 Họ tên: {profile_data['full_name']}\n"
        f"  🆔 MSSV: {profile_data['student_id']}\n"
        f"  📧 Email: {profile_data['email']}\n"
        f"  🏫 Khoa: {profile_data['faculty']}\n"
        f"  📚 Ngành: {profile_data['major']}\n"
        f"  🏷️ Lớp: {profile_data['class_name']}\n"
        f"  📅 Khóa: {profile_data['academic_year']}\n"
        f"  📊 GPA: {profile_data['gpa']}\n"
        f"  ✅ Tín chỉ tích lũy: {profile_data['credits_completed']}\n"
        f"  📌 Trạng thái: {profile_data['status']}"
    )
