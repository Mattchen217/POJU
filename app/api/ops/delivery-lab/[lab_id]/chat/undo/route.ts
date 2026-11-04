import { NextResponse } from "next/server";
import { requireOpsUser } from "@/lib/ops/require-ops";
import {
  appendLabAudit,
  loadDeliveryLab,
  saveDeliveryLab,
} from "@/lib/llm/pro/delivery/lab/store";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import {
  labUndoLastStep,
  labUndoTarget,
} from "@/lib/llm/pro/delivery/lab/pipeline-undo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — undo the latest LAB pipeline step (chat / Call A / Call B / synthesis / pending).
 * Parks at the prior cursor; does not re-enqueue.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ lab_id: string }> },
) {
  const auth = await requireOpsUser();
  if (!auth.ok) return auth.response;

  const { lab_id } = await ctx.params;
  const lab = await loadDeliveryLab(lab_id);
  if (!lab) {
    return NextResponse.json({ ok: false, error: "lab_not_found" }, { status: 404 });
  }
  if (lab.mode !== "full_pipeline") {
    return NextResponse.json({ ok: false, error: "not_full_pipeline" }, { status: 400 });
  }

  const target = labUndoTarget(lab);
  if (!target) {
    return NextResponse.json({ ok: false, error: "nothing_to_undo" }, { status: 400 });
  }

  try {
    const next = labUndoLastStep(lab);
    await saveDeliveryLab(next);
    await appendLabAudit({
      ops_user: auth.username,
      lab_id,
      action: "pipeline_step_undo",
      detail: `${target.kind}:${target.label}`,
    });
    return NextResponse.json({
      ok: true,
      lab: labPublicView(next),
      undone: target,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "undo_failed" },
      { status: 500 },
    );
  }
}
