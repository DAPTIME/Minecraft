@echo off
title DevCraft - Update
cd /d "%~dp0"

:: Try python3 first, fall back to python
where python3 >nul 2>nul
if %errorlevel%==0 (
  python3 update.py
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  python update.py
  goto :end
)

echo Python is not installed.
echo Download it from https://www.python.org/downloads/ and run this again.
echo.
pause
:end
