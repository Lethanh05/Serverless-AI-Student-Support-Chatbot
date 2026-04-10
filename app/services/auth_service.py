"""
Authentication Service
======================
Handles user registration (seeding), password verification, and login logic.
Mocks the UTH Portal — no real API calls.
"""

import logging
from typing import Optional

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.models import User

logger = logging.getLogger("chatbot")

# ---------------------------------------------------------------------------
# Password hashing with bcrypt
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plaintext password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def authenticate_user(db: Session, student_id: str, password: str) -> Optional[User]:
    """
    Mock UTH Portal authentication.
    Looks up the student in the local DB and verifies the password.

    Args:
        db: SQLAlchemy session.
        student_id: Student ID (e.g., "20110001").
        password: Plaintext password.

    Returns:
        User object if credentials are valid, None otherwise.
    """
    user = db.query(User).filter(User.student_id == student_id).first()

    if user is None:
        logger.info(f"Login failed: student_id={student_id} not found")
        return None

    if not verify_password(password, user.hashed_password):
        logger.info(f"Login failed: wrong password for student_id={student_id}")
        return None

    logger.info(f"Login successful: student_id={student_id}")
    return user


def seed_mock_users(db: Session) -> None:
    """
    Seed the database with mock student accounts for testing.
    Only inserts if the users table is empty.
    """
    existing_count = db.query(User).count()
    if existing_count > 0:
        logger.info(f"Database already has {existing_count} users, skipping seed.")
        return

    mock_users = [
        {
            "student_id": "20110001",
            "full_name": "Nguyễn Văn An",
            "email": "an.nguyen@student.uth.edu.vn",
            "password": "password123",
            "faculty": "Công nghệ Thông tin",
        },
        {
            "student_id": "20110002",
            "full_name": "Trần Thị Bình",
            "email": "binh.tran@student.uth.edu.vn",
            "password": "password123",
            "faculty": "Khoa học Máy tính",
        },
        {
            "student_id": "20110003",
            "full_name": "Lê Hoàng Cường",
            "email": "cuong.le@student.uth.edu.vn",
            "password": "password123",
            "faculty": "Kỹ thuật Phần mềm",
        },
    ]

    for user_data in mock_users:
        user = User(
            student_id=user_data["student_id"],
            full_name=user_data["full_name"],
            email=user_data["email"],
            hashed_password=hash_password(user_data["password"]),
            faculty=user_data["faculty"],
        )
        db.add(user)

    db.commit()
    logger.info(f"Seeded {len(mock_users)} mock users into database.")
