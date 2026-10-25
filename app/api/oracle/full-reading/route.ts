import { NextResponse } from "next/server";

export const maxDuration = 300;
export const runtime = "nodejs";

/** Glyph full reading is quarantined with the Glyph product tree. */
export async function POST() {
  return NextResponse.json({ error: "glyph_unavailable" }, { status: 410 });
}
