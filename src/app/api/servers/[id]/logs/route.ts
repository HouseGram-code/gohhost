import { NextRequest, NextResponse } from "next/server";

import * as engine from "@/lib/engine";
import { guardServer } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const g = await guardServer(req, ctx);
  if (!g.ok) return g.res;
  if (!(await engine.available()))
    return NextResponse.json({ lines: [], available: false });
  const url = new URL(req.url);
  const tailParam = Number(url.searchParams.get("tail") || "200");
  const tail = Math.min(1000, Math.max(1, Number.isFinite(tailParam) ? tailParam : 200));
  const lines = await engine.getLogs(g.id, tail);
  return NextResponse.json({ lines });
}
