import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoints: [
      "/api/poju/create",
      "/api/poju/chat",
      "/api/poju/collect",
      "/api/poju/session",
      "/api/poju/status",
      "/api/poju/action",
      "/api/poju/extend",
      "/api/poju/resolve",
      "/api/poju/restore",
    ],
  });
}
