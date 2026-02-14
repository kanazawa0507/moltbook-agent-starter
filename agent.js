/**
 * =============================================================
 * Moltbook エージェント テンプレート - メインスクリプト
 * =============================================================
 * OpenClaw エージェントフレームワークを使用して、
 * Moltbook上で自律的に活動するエージェント。
 *
 * ハートビート間隔ごとにMoltbookを訪れ、投稿・返信を行う。
 *
 * ★ カスタマイズ箇所は config/ フォルダ内のファイルです。
 *   このファイル自体は通常変更不要です。
 * =============================================================
 */

import { readFileSync } from "node:fs";
import { writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── 設定読み込み ───────────────────────────────────

const SYSTEM_PROMPT = readFileSync(
  join(__dirname, "config", "system-prompt.md"),
  "utf-8"
);
const KNOWLEDGE_BASE = readFileSync(
  join(__dirname, "config", "knowledge-base.md"),
  "utf-8"
);
const HEARTBEAT_CONFIG = JSON.parse(
  readFileSync(join(__dirname, "config", "heartbeat-config.json"), "utf-8")
);

// ─── 環境変数 ───────────────────────────────────────

const config = {
  llmProvider: process.env.LLM_PROVIDER || "gemini",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  moltbookAgentName: process.env.MOLTBOOK_AGENT_NAME || "MyAgent",
  moltbookAgentDescription:
    process.env.MOLTBOOK_AGENT_DESCRIPTION ||
    "My Moltbook Agent",
  moltbookApiKey: process.env.MOLTBOOK_API_KEY || "",
  heartbeatIntervalHours: parseInt(
    process.env.HEARTBEAT_INTERVAL_HOURS || "4",
    10
  ),
};

// ─── ログ関数 ────────────────────────────────────────

const LOG_DIR = join(__dirname, "data", "logs");
mkdirSync(LOG_DIR, { recursive: true });

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    message,
    ...(data ? { data } : {}),
  };
  const line = JSON.stringify(entry);

  // コンソール出力（Docker logs で確認可能）
  if (level === "ERROR") {
    console.error(`[${timestamp}] ${level}: ${message}`);
  } else {
    console.log(`[${timestamp}] ${level}: ${message}`);
  }

  // ファイル出力
  const logFile =
    level === "ERROR" ? "error.log" : "activity.log";
  appendFileSync(join(LOG_DIR, logFile), line + "\n", "utf-8");
}

// ─── Moltbook API クライアント ──────────────────────

const MOLTBOOK_API_BASE = "https://www.moltbook.com/api/v1";
const MOLTBOOK_CREDS_PATH = join(
  process.env.HOME || "/home/agentuser",
  ".config",
  "moltbook",
  "credentials.json"
);

async function moltbookRequest(endpoint, options = {}) {
  const apiKey = config.moltbookApiKey;
  if (!apiKey) {
    throw new Error("MOLTBOOK_API_KEY is not set");
  }

  const url = `${MOLTBOOK_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Moltbook API error ${response.status}: ${text}`);
  }

  return response.json();
}

// ─── Moltbook 登録 ──────────────────────────────────

async function registerOnMoltbook() {
  log("INFO", "Moltbook への登録を開始します...");

  try {
    const response = await fetch(`${MOLTBOOK_API_BASE}/agents/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: config.moltbookAgentName,
        description: config.moltbookAgentDescription,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Registration failed (${response.status}): ${text}`);
    }

    const result = await response.json();

    // APIキーを保存
    config.moltbookApiKey = result.api_key;

    // 認証情報をファイルに保存
    const credsDir = dirname(MOLTBOOK_CREDS_PATH);
    mkdirSync(credsDir, { recursive: true });
    writeFileSync(
      MOLTBOOK_CREDS_PATH,
      JSON.stringify(
        {
          api_key: result.api_key,
          agent_name: config.moltbookAgentName,
          registered_at: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf-8"
    );

    log("INFO", "Moltbook 登録成功！", {
      agent_name: config.moltbookAgentName,
    });

    // Claim URL を表示（人間がブラウザで開く）
    if (result.claim_url) {
      log("INFO", "=== 重要: 所有権証明 (Claim) が必要です ===");
      log("INFO", `Claim URL: ${result.claim_url}`);
      log(
        "INFO",
        `Verification Code: ${result.verification_code || "(URLに含まれています)"}`
      );
      log(
        "INFO",
        "上記URLをブラウザで開き、Xアカウントで認証してください。"
      );
      console.log("\n" + "=".repeat(60));
      console.log("  CLAIM YOUR AGENT - 所有権の証明");
      console.log("=".repeat(60));
      console.log(`  URL:  ${result.claim_url}`);
      if (result.verification_code) {
        console.log(`  Code: ${result.verification_code}`);
      }
      console.log(
        "  ブラウザでURLを開き、X(Twitter)で認証してください"
      );
      console.log("=".repeat(60) + "\n");
    }

    return result;
  } catch (error) {
    log("ERROR", `Moltbook 登録エラー: ${error.message}`);
    throw error;
  }
}

// ─── 保存済み認証情報の読み込み ─────────────────────

function loadCredentials() {
  try {
    const creds = JSON.parse(readFileSync(MOLTBOOK_CREDS_PATH, "utf-8"));
    if (creds.api_key) {
      config.moltbookApiKey = creds.api_key;
      log("INFO", "保存済みの認証情報を読み込みました");
      return true;
    }
  } catch {
    // ファイルが存在しない場合は無視
  }
  return false;
}

// ─── LLM 呼び出し ───────────────────────────────────

async function callLLM(userPrompt) {
  const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n# 知識ベース\n\n${KNOWLEDGE_BASE}\n\n---\n\n${userPrompt}`;

  if (config.llmProvider === "gemini" && config.geminiApiKey) {
    return callGemini(fullPrompt);
  } else if (config.openaiApiKey) {
    return callOpenAI(fullPrompt);
  } else {
    throw new Error(
      "LLM APIキーが設定されていません。.env を確認してください。"
    );
  }
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.8,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Gemini失敗時はOpenAIにフォールバック
    if (config.openaiApiKey) {
      log("INFO", "Gemini API失敗。OpenAIにフォールバックします。");
      return callOpenAI(prompt);
    }
    throw new Error(`Gemini API error: ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenAI(prompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ─── ハートビート（メインループ） ────────────────────

async function heartbeat() {
  log("INFO", "ハートビート開始 - Moltbookを訪問します");

  try {
    // 1. heartbeat.md を取得して指示を確認
    const heartbeatResponse = await fetch(
      "https://www.moltbook.com/heartbeat.md"
    );
    if (heartbeatResponse.ok) {
      const heartbeatInstructions = await heartbeatResponse.text();
      log("INFO", "heartbeat.md を取得しました");

      // 2. LLMにハートビートの指示と知識を渡して行動を決定
      const actionPrompt = `
あなたは Moltbook に参加しているエージェント「${config.moltbookAgentName}」です。
以下は Moltbook のハートビート指示です。この指示に従って行動してください。

--- ハートビート指示 ---
${heartbeatInstructions}
--- ここまで ---

あなたのキャラクター設定と知識ベースに基づいて、適切に行動してください。
投稿する場合は、テーマリストからランダムに選び、自然な投稿を生成してください。
返信する場合は、相手の話題に共感し、あなたの専門知識の視点から価値ある返信をしてください。
`;

      const response = await callLLM(actionPrompt);
      log("INFO", "LLM応答を受信しました", {
        response_length: response.length,
      });
    }

    log("INFO", "ハートビート完了");
  } catch (error) {
    log("ERROR", `ハートビートエラー: ${error.message}`);
  }
}

// ─── ジッター付きインターバル計算 ─────────────────────

function getNextInterval() {
  const baseMs = config.heartbeatIntervalHours * 60 * 60 * 1000;
  const jitterMs =
    HEARTBEAT_CONFIG.heartbeat.jitter_minutes * 60 * 1000;
  const jitter = (Math.random() - 0.5) * 2 * jitterMs;
  return Math.max(baseMs + jitter, 60 * 1000); // 最低1分
}

// ─── メイン ──────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log(`  Moltbook Agent: ${config.moltbookAgentName}`);
  console.log("=".repeat(60));
  console.log("");

  log("INFO", "エージェントを起動しています...", {
    llm_provider: config.llmProvider,
    agent_name: config.moltbookAgentName,
    heartbeat_interval_hours: config.heartbeatIntervalHours,
  });

  // 1. 認証情報の確認
  const hasCredentials = loadCredentials();

  if (!config.moltbookApiKey && !hasCredentials) {
    log("INFO", "Moltbook APIキーが未設定です。新規登録を行います。");
    try {
      await registerOnMoltbook();
    } catch (error) {
      log(
        "ERROR",
        "Moltbook登録に失敗しました。ネットワークを確認してください。"
      );
      log(
        "INFO",
        "30秒後に再試行します..."
      );
      await new Promise((resolve) => setTimeout(resolve, 30000));
      try {
        await registerOnMoltbook();
      } catch (retryError) {
        log(
          "ERROR",
          `再試行も失敗: ${retryError.message}`
        );
        log(
          "INFO",
          "手動で MOLTBOOK_API_KEY を .env に設定してください。"
        );
      }
    }
  } else {
    log("INFO", "Moltbook APIキーを確認しました。活動を開始します。");
  }

  // 2. 初回ハートビート
  log("INFO", "初回ハートビートを実行します...");
  await heartbeat();

  // 3. 定期ハートビートのスケジュール
  function scheduleNextHeartbeat() {
    const intervalMs = getNextInterval();
    const intervalMin = Math.round(intervalMs / 60000);
    log("INFO", `次のハートビートは ${intervalMin} 分後です`);

    setTimeout(async () => {
      await heartbeat();
      scheduleNextHeartbeat();
    }, intervalMs);
  }

  scheduleNextHeartbeat();

  log("INFO", "エージェントは正常に稼働しています。");
  log(
    "INFO",
    `ハートビート間隔: ${config.heartbeatIntervalHours}時間 (±${HEARTBEAT_CONFIG.heartbeat.jitter_minutes}分)`
  );
}

// ─── プロセスシグナル処理 ────────────────────────────

process.on("SIGTERM", () => {
  log("INFO", "SIGTERM を受信。エージェントを停止します...");
  process.exit(0);
});

process.on("SIGINT", () => {
  log("INFO", "SIGINT を受信。エージェントを停止します...");
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  log("ERROR", `未処理のPromise拒否: ${reason}`);
});

// ─── 起動 ────────────────────────────────────────────

main().catch((error) => {
  log("ERROR", `致命的エラー: ${error.message}`);
  process.exit(1);
});
