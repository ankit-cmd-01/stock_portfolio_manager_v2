#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-/var/www/stock_portfolio_manage_v2}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

cd "${PROJECT_ROOT}/backend"
"${PYTHON_BIN}" -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

cd "${PROJECT_ROOT}/frontend"
npm ci
npm run build

cd "${PROJECT_ROOT}/backend"
python manage.py migrate
python manage.py collectstatic --noinput

echo "Bootstrap completed. Optional forecasting extras:"
echo "  pip install -r ${PROJECT_ROOT}/backend/requirements-optional-forecasting.txt"

