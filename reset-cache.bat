@echo off
title DevCraft - Reset Cache
echo ============================================
echo   DevCraft - reset browser cache and settings
echo ============================================
echo.
echo This will:
echo   - tell the game to wipe its saved settings
echo   - force the browser to re-download every file
echo.
echo Make sure the DevCraft Server window is still running.
echo (If it isn't, double-click start-windows.bat first.)
echo.
timeout /t 2 /nobreak >nul

set PORT=8777
start "" "http://localhost:%PORT%/index.html?reset=1&v=%RANDOM%%TIME:~6,2%"

echo.
echo Done.  When the browser opens, press Ctrl+Shift+R once
echo to be sure every file is freshly fetched.
echo.
echo Press any key to close...
pause >nul
