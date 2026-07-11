#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo ""
echo "=== Certificate Fraud Detection — starting ==="
echo ""

if [[ ! -f backend/.env ]]; then
  echo "[setup] backend/.env missing — copying from backend/.env.example"
  cp backend/.env.example backend/.env
  echo "[setup] Edit backend/.env and add your API keys before verifying documents."
fi

if [[ ! -f frontend/.env ]]; then
  echo "[setup] frontend/.env missing — copying from frontend/.env.example"
  cp frontend/.env.example frontend/.env
fi

echo "[docker] docker compose up --build"
echo ""
docker compose up --build
