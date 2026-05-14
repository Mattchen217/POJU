import { NextResponse } from "next/server";

/** Discovery: v4 POJU only exposes the LLM proxy. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    routes: ["/api/poju/chat"],
    note: "POJU v4 sessions live in client IndexedDB; chat uses POST /api/poju/chat with { session, profile?, locale? }.",
  });
}
