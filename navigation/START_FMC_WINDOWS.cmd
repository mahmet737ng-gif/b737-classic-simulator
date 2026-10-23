@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."
echo.
echo Boeing 737 Classic - Private AIRAC 2610 FMC Route Lab
echo Only loopback 127.0.0.1 - never use for real navigation.
echo.
echo Enter the FULL local path to your private Stage-2 ZIP from ChatGPT Library.
echo Do NOT put that ZIP into the public GitHub repository folder.
set /p "NAVZIP=Private Stage-2 ZIP path: "
set "NAVZIP=%NAVZIP:"=%"
if not exist "%NAVZIP%" (
  echo ERROR: ZIP file does not exist: "%NAVZIP%"
  pause
  exit /b 1
)
echo.
echo A private ZIP will be extracted to your temporary directory.
echo After the server reports READY, open:
echo http://127.0.0.1:8765/navigation/fmc-lab/index.html
echo.
where py >nul 2>&1
if %errorlevel% equ 0 (
  py -3 navigation\fmc_server.py --private-zip "%NAVZIP%" --root . --port 8765
) else (
  python navigation\fmc_server.py --private-zip "%NAVZIP%" --root . --port 8765
)
pause