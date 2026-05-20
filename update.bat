@echo off
title DevCraft - Update
cd /d "%~dp0"
echo ============================================
echo   DevCraft - update to the latest version
echo ============================================
echo.

where git >nul 2>nul
if not %errorlevel%==0 (
  echo Git is not installed on this PC.
  echo Install it from https://git-scm.com/download/win and run this again.
  echo.
  pause
  exit /b
)

echo Fetching the latest changes...
echo.
git pull
set RESULT=%errorlevel%

echo.
if %RESULT%==0 (
  echo ============================================
  echo Update complete.
  echo Close the DevCraft Server window if it is still open,
  echo then double-click start-windows.bat to relaunch.
  echo ============================================
) else (
  echo ============================================
  echo Update failed.  See the messages above.
  echo (Local changes may need to be stashed or committed first.)
  echo ============================================
)
echo.
pause
