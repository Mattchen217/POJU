import { NextResponse } from "next/server";

/**
 * @deprecated Use POST /api/poju/breakthrough-core.
 * Thin forward — returns 410 with migration hint.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "situation-analysis is deprecated; use POST /api/poju/breakthrough-core",
      migrate_to: "/api/poju/breakthrough-core",
    },
    { status: 410 },
  );
}
