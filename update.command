#!/bin/bash
# Pull the latest DevCraft from git.
cd "$(dirname "$0")" || exit 1

echo "============================================"
echo "  DevCraft - update to the latest version"
echo "============================================"
echo

if ! command -v git >/dev/null 2>&1; then
  echo "Git is not installed."
  echo "Install it from https://git-scm.com/downloads and run this again."
  echo
  read -r -p "Press Enter to close..."
  exit 1
fi

echo "Fetching the latest changes..."
echo

if git pull; then
  echo
  echo "============================================"
  echo "Update complete."
  echo "Close the DevCraft Server window if it is still open,"
  echo "then double-click start-mac.command to relaunch."
  echo "============================================"
else
  echo
  echo "============================================"
  echo "Update failed.  See the messages above."
  echo "(Local changes may need to be stashed or committed first.)"
  echo "============================================"
fi

echo
read -r -p "Press Enter to close..."
