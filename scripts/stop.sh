#!/bin/bash
# =============================================================
# Moltbook エージェント - 停止
# =============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Moltbook エージェントを停止しています..."
echo ""

docker compose down

echo ""
echo "エージェントを停止しました。"
echo "再起動: ./scripts/start.sh"
echo ""
