import { NextResponse } from "next/server";
import {
  callAnswerInterpretationModel,
  isModelInterpretationContext,
} from "@/lib/poju/decision-intake/answer-interpretation-model";

/**
 * Decision Intake answer interpretation transport.
 * Request body: `{ context: ModelInterpretationContext, session_id, locked_provider? }`.
 * Returns the model's raw text only; the client parses, validates and
 * authorizes it deterministically. Nothing is stored here.
 */
export const maxDuration = 90;

const MAX_BODY_CHARS = 200_000;

export async function POST(req: Request) {
  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_CHARS) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  let body: { context?: unknown; session_id?: unknown; locked_provider?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  if (
    typeof body.session_id !== "string" ||
    !body.session_id.trim() ||
    !isModelInterpretationContext(body.context)
  ) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await callAnswerInterpretationModel({
      context: body.context,
      session_id: body.session_id,
      locked_provider: typeof body.locked_provider === "string" ? body.locked_provider : null,
      signal: req.signal,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const timedOut = message.includes("timeout") || message.includes("abort");
    console.error("[poju/answer-interpretation] model call failed", { timed_out: timedOut });
    return NextResponse.json(
      { ok: false, error: timedOut ? "timeout" : "call_failed" },
      { status: timedOut ? 504 : 502 },
    );
  }
}
