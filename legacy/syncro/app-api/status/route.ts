import { NextRequest, NextResponse } from "next/server";

import {
  getAllSyncroHours,
  getSyncroStatus,
  isSyncroKvConfigured,
} from "@/lib/syncro/syncro-status-kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "missing session_id" }, { status: 400 });
  }

  const kv_configured = isSyncroKvConfigured();
  const status = await getSyncroStatus(sessionId);
  if (!status) {
    return NextResponse.json({ status: null, hours: {}, kv_configured });
  }

  const hours = await getAllSyncroHours(sessionId, status.hour_order);

  return NextResponse.json({
    status,
    hours,
    kv_configured,
  });
}
