import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getOpsCredentials,
  getOpsSessionUsername,
  OPS_COOKIE_NAME,
} from "@/lib/ops/auth";

export async function requireOpsUser(): Promise<
  { ok: true; username: string } | { ok: false; response: NextResponse }
> {
  if (!getOpsCredentials()) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "ops_not_configured" }, { status: 503 }),
    };
  }
  const jar = await cookies();
  const token = jar.get(OPS_COOKIE_NAME)?.value;
  const username = getOpsSessionUsername(token);
  if (!username) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, username };
}
