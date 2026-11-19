import { NextResponse } from "next/server";

/**
 * Retired public Answer Interpretation proxy.
 *
 * Production DI2 model calls run only inside the server-authoritative chat turn
 * (`POST /api/poju/chat` → `executeAuthoritativeChatTurn` →
 * `callAnswerInterpretationModel`). Arbitrary clients must not submit fabricated
 * contexts or `locked_provider` values to spend OpenRouter budget here.
 */
export const maxDuration = 30;

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "endpoint_retired",
      message:
        "Answer Interpretation is only available inside the authoritative chat path",
    },
    { status: 410 },
  );
}

export async function GET() {
  return POST();
}
