import { NextRequest, NextResponse } from "next/server";

import * as engine from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const tailParam = Number(new URL(req.url).searchParams.get("tail") || "200");
  const tail = Math.min(1000, Math.max(1, Number.isFinite(tailParam) ? tailParam : 200));
  try {
    if (!(await engine.available())) {
      return NextResponse.json({ lines: [], available: false });
    }
    const lines = await engine.getLogs(id, tail);
    return NextResponse.json({ lines });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
