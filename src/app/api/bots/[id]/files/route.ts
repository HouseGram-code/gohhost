import { NextRequest, NextResponse } from "next/server";

import * as engine from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const name = new URL(req.url).searchParams.get("name");
  try {
    if (!(await engine.available())) {
      return NextResponse.json({ files: [], available: false });
    }
    if (name) {
      const content = await engine.readFile(id, name);
      return NextResponse.json({ name, content });
    }
    const files = await engine.listFiles(id);
    return NextResponse.json({ files });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    content?: string;
  };
  if (typeof body.name !== "string" || typeof body.content !== "string") {
    return NextResponse.json(
      { error: "name and content are required" },
      { status: 400 },
    );
  }
  try {
    if (!(await engine.available())) {
      return NextResponse.json({ error: "engine_unavailable" }, { status: 503 });
    }
    await engine.writeFile(id, body.name, body.content);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const name = new URL(req.url).searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  try {
    if (!(await engine.available())) {
      return NextResponse.json({ error: "engine_unavailable" }, { status: 503 });
    }
    await engine.deleteFile(id, name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
