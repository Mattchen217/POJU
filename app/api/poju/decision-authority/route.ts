import { NextResponse } from "next/server";

import {
  handleDecisionAuthority,
  type DecisionAuthorityAction,
} from "@/lib/poju/decision-authority/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set<DecisionAuthorityAction>(["append", "freeze", "register_profile", "head"]);

/**
 * Decision Intake 2.0 authority records.
 *   action=append            commit one DC change to the server ledger
 *   action=freeze            seal the ledger head as a Freeze (signed receipt)
 *   action=register_profile  recompute + register the profile for an existing Freeze
 *   action=head              current ledger head (writer token required)
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? (body.action.trim() as DecisionAuthorityAction) : null;
    if (!action || !ACTIONS.has(action)) {
      return NextResponse.json(
        { ok: false, code: "DC_AUTHORITY_BAD_REQUEST", error: "unknown action", retryable: false },
        { status: 400 },
      );
    }
    const { status, body: out } = await handleDecisionAuthority(action, body);
    return NextResponse.json(out, { status });
  } catch (e) {
    console.error("[decision-authority]", e instanceof Error ? e.message : "request failed");
    return NextResponse.json(
      { ok: false, code: "DC_AUTHORITY_INTERNAL", error: "decision authority request failed", retryable: true },
      { status: 500 },
    );
  }
}
