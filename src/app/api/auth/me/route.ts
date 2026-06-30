import { NextRequest, NextResponse } from "next/server";

import { currentUser, publicUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await currentUser(req);
  return NextResponse.json({ user: user ? publicUser(user) : null });
}
