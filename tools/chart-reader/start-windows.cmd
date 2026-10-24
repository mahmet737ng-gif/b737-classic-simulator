@echo off
setlocal
cd /d "%~dp0..\.."
set "READER_DATA=%LOCALAPPDATA%\B737-Technical-Reader"
if not exist ".reader-venv\Scripts\python.exe" (
  py -3 -m venv .reader-venv
  if errorlevel 1 goto failed
  .reader-venv\Scripts\python.exe -m pip install -r engine\technical_reader_v1\requirements.txt
  if errorlevel 1 goto failed
)
if not exist "%READER_DATA%" mkdir "%READER_DATA%"
.reader-venv\Scripts\python.exe -m engine.technical_reader_v2 --db "%READER_DATA%\reader.sqlite" --open-browser
if errorlevel 1 goto failed
exit /b 0
:failed
echo Python 3.11 or newer and the reader dependencies are required.
pause
exit /b 1
