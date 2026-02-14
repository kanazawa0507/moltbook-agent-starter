#!/bin/bash
# =============================================================
# Moltbook エージェント - ログ確認
# =============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Moltbook エージェントのログを表示しています..."
echo "Ctrl+C で終了"
echo "=========================================="
echo ""

docker compose logs -f
