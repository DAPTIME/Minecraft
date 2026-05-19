@echo off
title DevCraft Launcher
cd /d "%~dp0"
set PORT=8777

echo ============================================
echo   DevCraft - starting local game server...
echo ============================================
echo.

where python >nul 2>nul
if %errorlevel%==0 (
  start "DevCraft Server - close this window to quit" cmd /k python -m http.server %PORT%
  goto open
)
where py >nul 2>nul
if %errorlevel%==0 (
  start "DevCraft Server - close this window to quit" cmd /k py -m http.server %PORT%
  goto open
)

echo Could not find Python on this PC.
echo Install Python 3 from https://www.python.org/downloads/
echo (tick "Add Python to PATH" during setup), then run this file again.
echo.
pause
exit /b

:open
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%/index.html"
echo.
echo DevCraft opened in your browser.
echo Keep the "DevCraft Server" window open while playing.
echo You may close THIS window.
timeout /t 4 /nobreak >nul
