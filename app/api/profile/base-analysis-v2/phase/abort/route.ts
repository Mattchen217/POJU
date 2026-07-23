import { NextResponse } from "next/server";

import { releaseLock } from "@/lib/base-analysis/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { profile_id: string };

/** Client abort / failed retry cleanup — release phased analysis lock. */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const profileId = String(body.profile_id ?? "").trim();
  if (!profileId) {
    return NextResponse.json({ ok: false, error: "Missing profile_id" }, { status: 400 });
  }
  try {
    await releaseLock(profileId);
  } catch (e) {
    console.warn(
      "[base-analysis-v2/abort] releaseLock failed:",
      e instanceof Error ? e.message : e,
    );
    /* Cleanup best-effort — do not 500 the client overlay. */
  }
  return NextResponse.json({ ok: true });
}
