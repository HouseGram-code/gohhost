import { NextRequest, NextResponse } from "next/server";

import { login } from "@/lib/accounts";
import { publicUser, setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    nickname?: string;
    password?: string;
  };
  if (typeof body.nickname !== "string" || typeof body.password !== "string") {
    return NextResponse.json(
      { error: "Укажите никнейм и пароль" },
      { status: 400 },
    );
  }
  const user = await login(body.nickname, body.password);
  if (!user)
    return NextResponse.json(
      { error: "Неверный никнейм или пароль" },
      { status: 401 },
    );

  const out = NextResponse.json({ user: publicUser(user) });
  setSessionCookie(out, user.id);
  return out;
}
