import { NextRequest, NextResponse } from "next/server";

import { getUserByTelegram, listServersWithStatus } from "@/lib/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const key = process.env.BOT_API_KEY;
  return !!key && req.headers.get("x-bot-key") === key;
}

export async function GET(req: NextRequest) {
  if (!authorized(req))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const tid = Number(new URL(req.url).searchParams.get("telegramId"));
  if (!Number.isFinite(tid))
    return NextResponse.json({ error: "telegramId required" }, { status: 400 });

  const user = await getUserByTelegram(tid);
  if (!user)
    return NextResponse.json({ registered: false, servers: [] });

  const servers = await listServersWithStatus(user.id);
  return NextResponse.json({
    registered: true,
    nickname: user.nickname,
    siteUrl: process.env.SITE_URL || "",
    servers,
  });
}
