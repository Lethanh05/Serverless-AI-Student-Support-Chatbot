#!/bin/bash
# ============================================
# Run script for Student Chatbot Backend
# ============================================

echo "📦 Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "🚀 Starting Student Chatbot Backend..."
echo "📝 Swagger UI: http://127.0.0.1:8000/docs"
echo "📝 ReDoc:      http://127.0.0.1:8000/redoc"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
