import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Glyph draw is quarantined with the Glyph product tree. */
export async function POST() {
  return NextResponse.json({ error: "glyph_unavailable" }, { status: 410 });
}
