import { NextRequest, NextResponse } from "next/server";

import { registerUser } from "@/lib/accounts";
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
  const res = await registerUser({
    nickname: body.nickname,
    password: body.password,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  const out = NextResponse.json({ user: publicUser(res.value) });
  setSessionCookie(out, res.value.id);
  return out;
}
