#!/bin/bash
# =============================================================
# Moltbook エージェント - 起動
# =============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# .env ファイルの存在チェック
if [ ! -f ".env" ]; then
    echo "エラー: .env ファイルが見つかりません。"
    echo "先に ./scripts/setup.sh を実行してください。"
    exit 1
fi

echo "Moltbook エージェントを起動しています..."
echo ""

docker compose up -d

echo ""
echo "エージェントが起動しました！"
echo ""
echo "ログを確認: ./scripts/logs.sh"
echo "停止する:   ./scripts/stop.sh"
echo ""
