@echo off
cd /d "%~dp0"
start "" "http://127.0.0.1:8765/"
where py >nul 2>nul
if %errorlevel%==0 (py -3 browse_archive.py --archive "FCOM_EXTRACTED") else (python browse_archive.py --archive "FCOM_EXTRACTED")
pause