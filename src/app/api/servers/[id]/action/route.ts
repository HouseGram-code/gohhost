import { NextRequest, NextResponse } from "next/server";

import * as engine from "@/lib/engine";
import { guardServer } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const g = await guardServer(req, ctx);
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    if (!(await engine.available()))
      return NextResponse.json({ error: "engine_unavailable" }, { status: 503 });
    if (body.action === "start") await engine.start(g.id);
    else if (body.action === "stop") await engine.stop(g.id);
    else if (body.action === "restart") await engine.restart(g.id);
    else return NextResponse.json({ error: "unknown action" }, { status: 400 });
    const state = await engine.getState(g.id);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
