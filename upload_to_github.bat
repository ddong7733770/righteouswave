@echo off
chcp 65001 > nul
title 바른결 (BarunGyeol) - GitHub 원클릭 배포기

cd /d "%~dp0"

echo ========================================================
echo   [바른결] GitHub 원클릭 업로드 & 웹사이트 배포기
echo ========================================================
echo.
echo  이 스크립트는 바른결 웹사이트를 GitHub에 업로드하고,
echo  GitHub Pages 무료 웹 호스팅을 통해 전 세계 누구나
echo  휴대폰/PC에서 접속할 수 있는 웹사이트를 생성합니다.
echo.

python upload_to_github.py

pause
