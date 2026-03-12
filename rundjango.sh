bash#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/home/azureuser/stockmarket"
BACKEND_DIR="$PROJECT_ROOT/backend"
VENV_DIR="$BACKEND_DIR/.venv"

cd "$BACKEND_DIR"

source "$VENV_DIR/bin/activate"

if [ -f "$BACKEND_DIR/.env" ]; then
  set -a
  . "$BACKEND_DIR/.env"
  set +a
fi

exec gunicorn config.wsgi:application \
  --bind 127.0.0.1:8000 \
  --workers 3 \
  --threads 2 \
  --timeout 60
