import { after, NextResponse } from "next/server";

import { chargeDeliveryPass } from "@/lib/passes/charge-delivery-pass";
import { handleDecisionReportAction } from "@/lib/poju/decision-intake/decision-report-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Decision Intake 2.0 report — Freeze → Personal Analysis → eight pages.
 *   action=start     verify server Freeze + profile receipts, create/reuse job (regenerate=true → new generation);
 *                    a reused job without a worker is re-dispatched
 *   action=status    job + analysis + per-page checkpoints (client mirrors into its session)
 *   action=continue  ensure a worker for a running job, or resume an interrupted one from its checkpoints
 * Logic lives in `handleDecisionReportAction`; this wrapper supplies `after()` and the pass charge.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const reply = await handleDecisionReportAction(body, {
      background: (task) => after(task),
      charge: chargeDeliveryPass,
    });
    if (reply.kind === "response") return reply.response;
    return NextResponse.json(reply.body, { status: reply.status });
  } catch (e) {
    console.error("[decision-report]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "decision report request failed" },
      { status: 500 },
    );
  }
}
