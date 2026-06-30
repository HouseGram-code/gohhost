import { NextRequest, NextResponse } from "next/server";

import * as engine from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action;

  try {
    if (!(await engine.available())) {
      return NextResponse.json({ error: "engine_unavailable" }, { status: 503 });
    }
    if (action === "start") await engine.start(id);
    else if (action === "stop") await engine.stop(id);
    else if (action === "restart") await engine.restart(id);
    else
      return NextResponse.json({ error: "unknown action" }, { status: 400 });

    const state = await engine.getState(id);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
