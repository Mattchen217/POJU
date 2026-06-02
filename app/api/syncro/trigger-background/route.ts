import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** @deprecated Use POST /api/syncro/inngest_start */
export async function POST() {
  return NextResponse.json(
    {
      error: "deprecated",
      use: "/api/syncro/inngest_start",
    },
    { status: 410 },
  );
}
