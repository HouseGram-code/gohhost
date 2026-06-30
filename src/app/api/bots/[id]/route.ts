import { NextRequest, NextResponse } from "next/server";

import * as engine from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function maskToken(token: string) {
  return token ? token.slice(0, 4) + "•••••" : "";
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const [state, config] = await Promise.all([
      engine.getState(id),
      engine.getConfig(id),
    ]);
    return NextResponse.json({
      state,
      config: {
        name: config.name,
        startupFile: config.startupFile,
        autoRestart: config.autoRestart,
        token: maskToken(config.token),
        tokenSet: !!config.token,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    startupFile: string;
    autoRestart: boolean;
    token: string;
  }>;
  try {
    const patch: Partial<engine.BotConfig> = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.startupFile === "string")
      patch.startupFile = body.startupFile;
    if (typeof body.autoRestart === "boolean")
      patch.autoRestart = body.autoRestart;
    // Токен обновляем только если прислали новый (не маску).
    if (typeof body.token === "string" && body.token && !body.token.includes("•"))
      patch.token = body.token;

    const config = await engine.saveConfig(id, patch);
    return NextResponse.json({
      config: {
        name: config.name,
        startupFile: config.startupFile,
        autoRestart: config.autoRestart,
        token: maskToken(config.token),
        tokenSet: !!config.token,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
