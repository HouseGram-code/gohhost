import { NextRequest, NextResponse } from "next/server";

import {
  createServer,
  getUserByTelegram,
  registerUser,
} from "@/lib/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const key = process.env.BOT_API_KEY;
  return !!key && req.headers.get("x-bot-key") === key;
}

// Вызывается Telegram-ботом. Создаёт аккаунт (если новый telegram-пользователь)
// и сервер. Возвращает данные для входа на сайт.
export async function POST(req: NextRequest) {
  if (!authorized(req))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    telegramId?: number;
    name?: string;
    nickname?: string;
    password?: string;
  };
  const { telegramId, name, nickname, password } = body;
  if (
    typeof telegramId !== "number" ||
    typeof name !== "string" ||
    typeof nickname !== "string" ||
    typeof password !== "string"
  )
    return NextResponse.json({ error: "Неверные данные" }, { status: 400 });

  let user = await getUserByTelegram(telegramId);
  let createdAccount = false;

  if (!user) {
    const reg = await registerUser({ nickname, password, telegramId });
    if (!reg.ok) return NextResponse.json({ error: reg.error }, { status: 400 });
    user = reg.value;
    createdAccount = true;
  }

  const res = await createServer(user.id, name, "free");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    createdAccount,
    nickname: user.nickname,
    siteUrl: process.env.SITE_URL || "",
    server: { id: res.value.id, name: res.value.name, tariff: res.value.tariff },
  });
}
