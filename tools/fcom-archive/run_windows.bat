@echo off
setlocal
chcp 65001 >nul
if "%~1"=="" (
  echo Drag and drop your authorized FCOM PDF onto this batch file.
  echo OR run: run_windows.bat "C:\path\to\FCOM.pdf"
  pause
  exit /b 1
)
where py >nul 2>nul
if %errorlevel%==0 (set "PY=py -3") else (set "PY=python")
%PY% -m pip install --upgrade pymupdf
if errorlevel 1 goto :fail
%PY% "%~dp0extract_fcom.py" "%~1" --out "%~dp0FCOM_EXTRACTED" --resume --render-dpi 120 --tables lines
if errorlevel 1 goto :fail
%PY% "%~dp0verify_archive.py" "%~dp0FCOM_EXTRACTED" --require-images
if errorlevel 1 goto :fail
echo Done. The FCOM is now searchable without the PDF.
echo Example: %PY% "%~dp0search_archive.py" "Autothrottle" --db "%~dp0FCOM_EXTRACTED\fcom.sqlite"
pause
exit /b 0
:fail
echo Extraction failed. See the log above. Re-run safely with --resume.
pause
exit /b 1