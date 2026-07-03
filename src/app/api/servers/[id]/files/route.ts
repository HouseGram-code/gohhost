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
    return NextResponse.json({ files: [], available: false });
  const name = new URL(req.url).searchParams.get("name");
  if (name) {
    const content = await engine.readFile(g.id, name);
    return NextResponse.json({ name, content });
  }
  const files = await engine.listFiles(g.id);
  return NextResponse.json({ files });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const g = await guardServer(req, ctx);
  if (!g.ok) return g.res;
  if (!(await engine.available()))
    return NextResponse.json({ error: "engine_unavailable" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    content?: string;
  };
  if (typeof body.name !== "string" || typeof body.content !== "string")
    return NextResponse.json({ error: "name and content required" }, { status: 400 });
  await engine.writeFile(g.id, body.name, body.content);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const g = await guardServer(req, ctx);
  if (!g.ok) return g.res;
  const name = new URL(req.url).searchParams.get("name");
  if (!name)
    return NextResponse.json({ error: "name required" }, { status: 400 });
  await engine.deleteFile(g.id, name);
  return NextResponse.json({ ok: true });
}
