"""
Student Chatbot — FastAPI Application
=======================================
Main entry point. Sets up:
- CORS middleware
- Request/response logging
- Database initialization with seed data
- All API routers

Run with: uvicorn app.main:app --reload
Swagger UI: http://127.0.0.1:8000/docs
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import engine, SessionLocal, Base
from app.models import User, ChatHistory  # noqa: F401 — ensure models are registered
from app.routers import auth, chat, student
from app.services.auth_service import seed_mock_users

# ===========================================================================
# Logging Configuration
# ===========================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("chatbot")


# ===========================================================================
# Application Lifespan — runs on startup & shutdown
# ===========================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup:
        1. Create all database tables
        2. Seed mock users
    Shutdown:
        (cleanup if needed)
    """
    logger.info("🚀 Starting Student Chatbot Backend...")

    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created")

    # Seed mock data
    db = SessionLocal()
    try:
        seed_mock_users(db)
        logger.info("✅ Mock data seeded")
    finally:
        db.close()

    logger.info("✅ Application ready!")
    logger.info("📝 Swagger UI: http://127.0.0.1:8000/docs")

    yield  # Application is running

    logger.info("👋 Shutting down Student Chatbot Backend...")


# ===========================================================================
# FastAPI App Instance
# ===========================================================================
app = FastAPI(
    title="🎓 UTH Student Chatbot API",
    description=(
        "**Cloud-based Student Chatbot System** for UTH University.\n\n"
        "### Features:\n"
        "- 🔐 JWT Authentication (mock UTH Portal)\n"
        "- 💬 AI-powered Chat (OpenAI or mock fallback)\n"
        "- 📅 Student Schedule & Profile lookup\n"
        "- 🧠 Rule-based Intent Detection (Vietnamese + English)\n"
        "- 📊 Chat History with pagination\n\n"
        "### Test Accounts:\n"
        "| Student ID | Password | Name |\n"
        "|---|---|---|\n"
        "| `20110001` | `password123` | Nguyễn Văn An |\n"
        "| `20110002` | `password123` | Trần Thị Bình |\n"
        "| `20110003` | `password123` | Lê Hoàng Cường |"
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ===========================================================================
# CORS Middleware — allow all origins for development
# ===========================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],              # Restrict in production!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================================================================
# Request / Response Logging Middleware
# ===========================================================================
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    Logs every incoming request and outgoing response.
    Includes method, path, status code, and processing time.
    """
    start_time = time.time()

    # Log incoming request
    logger.info(f"→ {request.method} {request.url.path}")

    try:
        response = await call_next(request)
    except Exception as exc:
        logger.error(f"✗ {request.method} {request.url.path} — Unhandled error: {str(exc)}")
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Lỗi hệ thống. Vui lòng thử lại sau. (Internal server error.)"
            },
        )

    # Calculate processing time
    duration = time.time() - start_time

    # Log outgoing response
    logger.info(
        f"← {request.method} {request.url.path} — "
        f"status={response.status_code} — "
        f"time={duration:.3f}s"
    )

    return response


# ===========================================================================
# Include Routers
# ===========================================================================
app.include_router(auth.router)
app.include_router(student.router)
app.include_router(chat.router)


# ===========================================================================
# Root Endpoint
# ===========================================================================
@app.get("/", tags=["🏠 Home"])
def root():
    """
    Welcome endpoint — confirms the API is running.
    """
    return {
        "message": "🎓 Welcome to UTH Student Chatbot API!",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "endpoints": {
            "auth": {
                "login": "POST /auth/login",
                "me": "GET /auth/me",
            },
            "student": {
                "schedule": "GET /student/schedule",
                "profile": "GET /student/profile",
            },
            "chat": {
                "send": "POST /chat",
                "history": "GET /chat/history",
            },
        },
    }


@app.get("/health", tags=["🏠 Home"])
def health_check():
    """
    Health check endpoint for monitoring.
    """
    return {"status": "healthy", "service": "student-chatbot"}
