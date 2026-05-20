#!/bin/bash
# Tell DevCraft to wipe saved settings and force a fresh page load.
cd "$(dirname "$0")" || exit 1

echo "============================================"
echo "  DevCraft - reset browser cache & settings"
echo "============================================"
echo
echo "This opens the game with a flag that wipes its saved settings"
echo "and forces the browser to re-fetch every file."
echo
echo "Make sure the DevCraft Server window is still running."
echo "(If it isn't, double-click start-mac.command first.)"
echo

sleep 1

PORT=8777
URL="http://localhost:$PORT/index.html?reset=1&v=$RANDOM"
if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"
else
  echo "Open this URL in your browser: $URL"
fi

echo
echo "Done.  Press Cmd+Shift+R in the browser once for a hard refresh."
read -r -p "Press Enter to close..."
