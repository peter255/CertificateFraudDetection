#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo ""
echo "=== Certificate Fraud Detection — stopping ==="
echo ""
docker compose down
echo ""
echo "Containers stopped."
