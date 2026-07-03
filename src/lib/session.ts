import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
} from "./auth";
import { getUserById, userOwnsServer, type User } from "./accounts";

export async function currentUser(req: NextRequest): Promise<User | null> {
  const uid = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  return getUserById(uid);
}

export function setSessionCookie(res: NextResponse, userId: string): void {
  res.cookies.set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
}

export function publicUser(u: User) {
  return { id: u.id, nickname: u.nickname, telegram: u.telegramId != null };
}

type Guard =
  | { ok: true; user: User; id: string }
  | { ok: false; res: NextResponse };

// Проверяет сессию и владение сервером для роутов /api/servers/[id]/*.
export async function guardServer(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Guard> {
  const user = await currentUser(req);
  if (!user)
    return {
      ok: false,
      res: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  const { id } = await ctx.params;
  if (!(await userOwnsServer(user.id, id)))
    return {
      ok: false,
      res: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  return { ok: true, user, id };
}
