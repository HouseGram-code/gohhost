import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// GitHub webhook secret — установите в настройках webhook на GitHub
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";

/**
 * Проверка подписи GitHub webhook
 */
function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("⚠️ GITHUB_WEBHOOK_SECRET не установлен — проверка подписи пропущена");
    return true; // В dev разрешаем без подписи
  }

  const hmac = createHmac("sha256", WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  return signature === digest;
}

/**
 * GitHub Webhook для автообновления при push
 * 
 * Настройка на GitHub:
 * 1. Репозиторий → Settings → Webhooks → Add webhook
 * 2. Payload URL: https://your-domain.com/api/webhook/github
 * 3. Content type: application/json
 * 4. Secret: установите GITHUB_WEBHOOK_SECRET в .env
 * 5. Events: Just the push event
 */
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-hub-signature-256") || "";
    const event = req.headers.get("x-github-event") || "";
    
    const body = await req.text();
    
    // Проверяем подпись
    if (!verifySignature(body, signature)) {
      console.error("❌ Неверная подпись webhook");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Парсим payload
    const payload = JSON.parse(body);
    
    // Обрабатываем только push события в main ветку
    if (event !== "push") {
      return NextResponse.json({ message: "Event ignored (not a push)" });
    }

    const ref = payload.ref || "";
    const branch = ref.replace("refs/heads/", "");
    
    if (branch !== "main") {
      return NextResponse.json({ 
        message: `Branch ignored (${branch} != main)` 
      });
    }

    const commits = payload.commits || [];
    const pusher = payload.pusher?.name || "unknown";
    const commitMsg = commits[0]?.message || "No message";
    
    console.log(`📦 GitHub webhook: push от ${pusher} в ${branch}`);
    console.log(`📝 Коммит: ${commitMsg}`);

    // Запускаем скрипт обновления на хосте через docker exec
    // (контейнер имеет доступ к docker.sock, поэтому может управлять хост-процессами)
    const hostRepoDir = process.env.HOST_REPO_DIR || "/root/goh-hosting";
    const updateCmd = `cd ${hostRepoDir} && bash update.sh >> /tmp/goh-update.log 2>&1`;
    
    // Запускаем на хосте через docker exec с хост-контекстом
    execAsync(`bash -c '${updateCmd}'`)
      .then(() => {
        console.log("✅ Обновление завершено");
      })
      .catch((error) => {
        console.error("❌ Ошибка обновления:", error);
      });

    return NextResponse.json({
      message: "Update started",
      branch,
      commits: commits.length,
      pusher,
    });
  } catch (error) {
    console.error("❌ Ошибка обработки webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Для проверки доступности endpoint
export async function GET() {
  return NextResponse.json({
    service: "GitHub Webhook Handler",
    status: "ready",
    secretConfigured: !!WEBHOOK_SECRET,
  });
}
