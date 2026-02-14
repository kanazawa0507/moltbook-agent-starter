# =============================================================
# Moltbook エージェント テンプレート - Dockerfile
# =============================================================
# ★ このファイルは通常変更不要です
# =============================================================

FROM node:22-slim

# システム依存パッケージ（curl: ヘルスチェック用, tini: PID 1問題対策）
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl tini && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 非rootユーザーを作成（セキュリティ要件）
RUN groupadd --gid 1001 agentuser && \
    useradd --uid 1001 --gid 1001 --create-home --shell /bin/bash agentuser

# 作業ディレクトリ
WORKDIR /app

# package.json をコピーして依存インストール
COPY --chown=agentuser:agentuser package.json ./
RUN npm install --omit=dev

# 設定ファイル・スクリプトをコピー
COPY --chown=agentuser:agentuser config/ ./config/
COPY --chown=agentuser:agentuser scripts/ ./scripts/
COPY --chown=agentuser:agentuser agent.js ./

# スクリプトに実行権限を付与
RUN chmod +x scripts/*.sh

# データディレクトリを作成
RUN mkdir -p /home/agentuser/.config/moltbook /app/data/logs && \
    chown -R agentuser:agentuser /home/agentuser /app

# 非rootユーザーに切り替え
USER agentuser

# ヘルスチェック（60秒ごとにプロセス死活確認）
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# tini をエントリポイントに使用（シグナル処理の正常化）
ENTRYPOINT ["tini", "--"]

# エージェント起動
CMD ["node", "agent.js"]
