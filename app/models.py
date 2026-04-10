"""
SQLAlchemy ORM Models
=====================
Defines the database tables: users & chat_history.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    """
    Users table — stores student account info.
    Passwords are hashed with bcrypt via passlib.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(String(20), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    faculty = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship: one user → many chat messages
    chat_history = relationship("ChatHistory", back_populates="user")

    def __repr__(self):
        return f"<User(id={self.id}, student_id={self.student_id})>"


class ChatHistory(Base):
    """
    Chat history table — stores every message (user & bot).
    """
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # nullable for anonymous chats
    role = Column(String(10), nullable=False)        # "user" or "assistant"
    message = Column(Text, nullable=False)
    intent = Column(String(50), nullable=True)       # detected intent label
    session_id = Column(String(100), nullable=True)  # optional session grouping
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship back to user
    user = relationship("User", back_populates="chat_history")

    def __repr__(self):
        return f"<ChatHistory(id={self.id}, role={self.role})>"
