import { after, NextResponse } from "next/server";
import { requireOpsUser } from "@/lib/ops/require-ops";
import {
  appendLabAudit,
  loadDeliveryLab,
  saveDeliveryLab,
} from "@/lib/llm/pro/delivery/lab/store";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import { rerunLabPipelineCurrentStep } from "@/lib/llm/pro/delivery/lab/pipeline-chat";
import {
  labApplyPendingJobByLabId,
  labRunSegment2AJob,
  labRunSegment2BJob,
  labRunSynthesisJob,
} from "@/lib/llm/pro/delivery/lab/pipeline-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  try {
    const next = await rerunLabPipelineCurrentStep(lab);
    await saveDeliveryLab(next);

    const pending = next.pipeline_pending_job;
    if (pending) {
      after(async () => {
        try {
          if (pending.stage === "segment2_a") {
            // LAB split: Call A only → park awaiting_agenda (ops clicks Next for Call B).
            await labRunSegment2AJob(pending.job_id, {
              onSettled: async () => {
                await labApplyPendingJobByLabId(lab_id);
              },
            });
          } else if (pending.stage === "segment2_b") {
            await labRunSegment2BJob(pending.job_id);
            await labApplyPendingJobByLabId(lab_id);
          } else if (pending.stage === "synthesis") {
            await labRunSynthesisJob(pending.job_id);
            await labApplyPendingJobByLabId(lab_id);
          }
        } catch (e) {
          console.error("[lab-chat/rerun] job kick failed", e);
          try {
            await labApplyPendingJobByLabId(lab_id);
          } catch (applyErr) {
            console.error("[lab-chat/rerun] apply-after-fail also failed", applyErr);
          }
        }
      });
    }

    await appendLabAudit({
      ops_user: auth.username,
      lab_id,
      action: "pipeline_step_rerun",
      detail: pending ? `${pending.stage}:${pending.job_id}` : "chat",
    });
    return NextResponse.json({
      ok: true,
      lab: labPublicView(next),
      job_id: pending?.job_id ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "rerun_failed" },
      { status: 500 },
    );
  }
}
