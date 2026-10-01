@echo off
chcp 65001 > nul
title 바른결 (BarunGyeol) 실행기

cd /d "%~dp0"

python -c "import fastapi, uvicorn, requests, bs4" 2>nul
if %errorlevel% neq 0 (
    echo [*] 필수 패키지 설치 진행 중... (fastapi, uvicorn 등)
    pip install -r requirements.txt
)

python start_app.py

pause
