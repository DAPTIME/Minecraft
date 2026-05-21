#!/bin/bash
cd "$(dirname "$0")" || exit 1

if command -v python3 >/dev/null 2>&1; then
  python3 update.py
elif command -v python >/dev/null 2>&1; then
  python update.py
else
  echo "Python is not installed."
  echo "Install it from https://www.python.org/downloads/ and run this again."
  echo
  read -r -p "Press Enter to close..."
  exit 1
fi
