@echo off
echo ============================================
echo  Smart Bus Ticketing System - Backend Setup
echo ============================================

cd /d "%~dp0"

echo.
echo [1/3] Cai dat dependencies...
pip install -r requirements.txt

echo.
echo [2/3] Tao file .env (neu chua co)...
if not exist .env (
    copy .env.example .env
    echo .env da duoc tao tu .env.example
    echo Vui long chinh sua DB_PASSWORD trong file .env
) else (
    echo .env da ton tai
)

echo.
echo [3/3] Chay server...
echo API docs: http://localhost:8000/docs
echo.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
