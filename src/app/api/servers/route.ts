import { NextRequest, NextResponse } from "next/server";

import { createServer, listServersWithStatus } from "@/lib/accounts";
import * as engine from "@/lib/engine";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await currentUser(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const servers = await listServersWithStatus(user.id);
  return NextResponse.json({
    servers,
    engineAvailable: await engine.available(),
  });
}

export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  if (typeof body.name !== "string")
    return NextResponse.json(
      { error: "Укажите название сервера" },
      { status: 400 },
    );
  const res = await createServer(user.id, body.name, "free");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ server: res.value });
}
