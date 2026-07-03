import { NextRequest, NextResponse } from "next/server";

// ── Защита от атак на уровне приложения (Next.js 16 proxy) ───────────
// 1) Блокировка типовых сканеров уязвимостей.
// 2) Ограничение частоты запросов по IP (анти-флуд / простой анти-DDoS).
// Хранилище в памяти процесса: для одного контейнера достаточно.
// Для нескольких реплик выносите счётчики в Redis.

const WINDOW_MS = 60_000; // окно 1 минута
const MAX_REQUESTS = 200; // лимит запросов на IP в окне

type Hit = { count: number; resetAt: number };
const hits = new Map<string, Hit>();

// Подозрительные пути, которые ищут боты-сканеры.
const BLOCKED_PATHS = [
  /\/\.env(\.|$)/i,
  /\/\.git(\/|$)/i,
  /\/\.aws(\/|$)/i,
  /\/wp-(admin|login|content|includes)/i,
  /\/xmlrpc\.php/i,
  /\/phpmyadmin/i,
  /\/vendor\//i,
  /\.(php|asp|aspx|jsp)$/i,
];

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Блокируем сканеров.
  if (BLOCKED_PATHS.some((re) => re.test(pathname))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 2) Рейт-лимит по IP.
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
    if (entry.count > MAX_REQUESTS) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "Cache-Control": "no-store",
        },
      });
    }
  }

  // Лёгкая чистка устаревших записей, чтобы Map не рос бесконечно.
  if (hits.size > 10_000) {
    for (const [key, value] of hits) {
      if (now > value.resetAt) hits.delete(key);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Не трогаем статику и оптимизированные картинки.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
