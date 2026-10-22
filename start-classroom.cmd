@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required. Install Node.js then reopen this file.
  pause
  exit /b 1
)
echo Starting B737 shared classroom for Captain / First Officer / Instructor ...
echo Keep this window open while devices are connected.
node sync-server\server.js
if errorlevel 1 (
  echo Server stopped with an error.
  pause
)