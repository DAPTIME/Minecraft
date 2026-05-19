#!/bin/bash
# DevCraft launcher for macOS and Linux. Double-click to play.
cd "$(dirname "$0")" || exit 1
PORT=8777

echo "============================================"
echo "  DevCraft - starting local game server..."
echo "============================================"
echo

open_browser() {
  sleep 2
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:$PORT/index.html"          # macOS
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:$PORT/index.html"      # Linux
  else
    echo "Open this in your browser: http://localhost:$PORT/index.html"
  fi
}

if command -v python3 >/dev/null 2>&1; then
  open_browser &
  echo "DevCraft is running. Close this window to quit."
  python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  open_browser &
  echo "DevCraft is running. Close this window to quit."
  python -m http.server "$PORT"
else
  echo "Python 3 is required but was not found."
  echo "Install it from https://www.python.org/downloads/ and run this again."
  read -r -p "Press Enter to close..."
fi
