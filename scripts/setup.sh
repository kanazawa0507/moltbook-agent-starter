#!/bin/bash
# =============================================================
# Moltbook エージェント - 初回セットアップ
# =============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "  Moltbook Agent - Initial Setup"
echo "=========================================="
echo ""

# .env ファイルの作成
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "[1/3] .env ファイルを作成しています..."
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    echo "  -> .env.example を .env にコピーしました"
    echo ""
    echo "  *** 重要 ***"
    echo "  .env ファイルを開いて、以下を設定してください："
    echo "    - GEMINI_API_KEY (Google AI Studio で取得)"
    echo "    - OPENAI_API_KEY (OpenAI Platform で取得・任意)"
    echo "    - MOLTBOOK_AGENT_NAME (あなたのエージェント名)"
    echo "    - MOLTBOOK_AGENT_DESCRIPTION (エージェントの説明・英語)"
    echo ""
else
    echo "[1/3] .env ファイルは既に存在します。スキップします。"
fi

# data ディレクトリの作成
echo "[2/3] データディレクトリを作成しています..."
mkdir -p "$PROJECT_DIR/data/logs"
echo "  -> data/logs/ を作成しました"

# Docker イメージのビルド
echo "[3/3] Docker イメージをビルドしています..."
cd "$PROJECT_DIR"
docker compose build

echo ""
echo "=========================================="
echo "  セットアップ完了！"
echo "=========================================="
echo ""
echo "次のステップ："
echo "  1. .env ファイルにAPIキーとエージェント情報を設定"
echo "  2. config/system-prompt.md でキャラクター設定をカスタマイズ"
echo "  3. config/knowledge-base.md に知識を記入"
echo "  4. ./scripts/start.sh でエージェントを起動"
echo ""
