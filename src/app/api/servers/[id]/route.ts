import { NextRequest, NextResponse } from "next/server";

import { deleteServer } from "@/lib/accounts";
import * as engine from "@/lib/engine";
import { guardServer } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function maskToken(token: string) {
  return token ? token.slice(0, 4) + "•••••" : "";
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const g = await guardServer(req, ctx);
  if (!g.ok) return g.res;
  if (!(await engine.available()))
    return NextResponse.json({ available: false });
  const [state, config] = await Promise.all([
    engine.getState(g.id),
    engine.getConfig(g.id),
  ]);
  return NextResponse.json({
    available: true,
    state,
    config: {
      name: config.name,
      startupFile: config.startupFile,
      autoRestart: config.autoRestart,
      token: maskToken(config.token),
      tokenSet: !!config.token,
    },
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const g = await guardServer(req, ctx);
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    startupFile: string;
    autoRestart: boolean;
    token: string;
  }>;
  const patch: Partial<engine.BotConfig> = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.startupFile === "string") patch.startupFile = body.startupFile;
  if (typeof body.autoRestart === "boolean") patch.autoRestart = body.autoRestart;
  if (typeof body.token === "string" && body.token && !body.token.includes("•"))
    patch.token = body.token;
  const config = await engine.saveConfig(g.id, patch);
  return NextResponse.json({
    config: {
      name: config.name,
      startupFile: config.startupFile,
      autoRestart: config.autoRestart,
      token: maskToken(config.token),
      tokenSet: !!config.token,
    },
  });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const g = await guardServer(req, ctx);
  if (!g.ok) return g.res;
  await engine.destroy(g.id).catch(() => {});
  await deleteServer(g.user.id, g.id);
  return NextResponse.json({ ok: true });
}
