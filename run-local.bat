@echo off
cd /d "%~dp0"
echo Starting Retrospective Room at http://localhost:8000
echo Keep this window open while using the app.
python -m http.server 8000
pause
