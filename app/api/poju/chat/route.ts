import { NextResponse } from "next/server";
import { callPOJULLM } from "@/lib/llm/poju-llm";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

/**
 * POJU v4 only: proxy to Claude with `buildPOJUSystemPrompt`.
 * Request body: `{ session, profile?, locale? }` (session must include `session_id`).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    locale?: string;
    userProfile?: UserProfile | null;
    session?: POJUSessionState;
    profile?: UserProfile | null;
  };

  if (!body.session || typeof body.session !== "object" || typeof body.session.session_id !== "string") {
    return NextResponse.json(
      { error: "v4 session required: send { session: POJUSessionState, profile?, locale? }" },
      { status: 400 },
    );
  }

  const llm = await callPOJULLM({
    session: body.session,
    profile: body.profile ?? body.userProfile ?? null,
    locale: String(body.locale ?? "en"),
  });
  return NextResponse.json(llm);
}
