@echo off
cd /d %~dp0
python -m uvicorn api_service:app --host 0.0.0.0 --port 8000
pause
