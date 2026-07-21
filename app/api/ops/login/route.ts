import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createOpsSessionToken,
  getOpsCredentials,
  OPS_COOKIE_NAME,
  opsCookieOptions,
  verifyOpsLogin,
} from "@/lib/ops/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const creds = getOpsCredentials();
  if (!creds) {
    return NextResponse.json(
      { ok: false, error: "ops_not_configured" },
      { status: 503 },
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!verifyOpsLogin(username, password)) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  const token = createOpsSessionToken(creds.user, creds.secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPS_COOKIE_NAME, token, opsCookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPS_COOKIE_NAME, "", opsCookieOptions(0));
  return res;
}

/** Session probe for the ops UI. */
export async function GET() {
  const jar = await cookies();
  const token = jar.get(OPS_COOKIE_NAME)?.value;
  const { verifyOpsSessionToken } = await import("@/lib/ops/auth");
  if (!verifyOpsSessionToken(token)) {
    return NextResponse.json({ ok: false, authed: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, authed: true });
}
