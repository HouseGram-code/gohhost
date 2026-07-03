import { NextRequest, NextResponse } from "next/server";

import * as engine from "@/lib/engine";
import { guardServer } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Установка pip-библиотек для бота: сохраняет пакет(ы) в requirements.txt
// и, если бот сейчас запущен, ставит их сразу через `docker exec` — без
// перезапуска контейнера.
export async function POST(req: NextRequest, ctx: Ctx) {
  const g = await guardServer(req, ctx);
  if (!g.ok) return g.res;
  if (!(await engine.available()))
    return NextResponse.json({ error: "engine_unavailable" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { packages?: string };
  if (typeof body.packages !== "string" || !body.packages.trim())
    return NextResponse.json({ error: "packages required" }, { status: 400 });

  try {
    const result = await engine.installPackage(g.id, body.packages);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
}
