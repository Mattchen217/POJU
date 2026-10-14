import { after, NextResponse } from "next/server";
import { requireOpsUser } from "@/lib/ops/require-ops";
import {
  appendLabAudit,
  loadDeliveryLab,
  saveDeliveryLab,
} from "@/lib/llm/pro/delivery/lab/store";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import {
  labApplyPendingJobByLabId,
  labPollPipelineJob,
  labRunSynthesisJob,
} from "@/lib/llm/pro/delivery/lab/pipeline-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
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
    const next = await labPollPipelineJob(lab);
    if (next !== lab) {
      try {
        await saveDeliveryLab(next);
      } catch (saveErr) {
        console.warn("[lab-jobs/synthesis] save failed — apply resilient path", saveErr);
        const applied = await labApplyPendingJobByLabId(lab_id);
        if (applied) {
          return NextResponse.json({ ok: true, lab: labPublicView(applied) });
        }
        throw saveErr;
      }
    }
    return NextResponse.json({ ok: true, lab: labPublicView(next) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "poll_failed" },
      { status: 500 },
    );
  }
}

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
  const pending = lab.pipeline_pending_job;
  if (!pending || pending.stage !== "synthesis") {
    return NextResponse.json({ ok: false, error: "no_synthesis_pending" }, { status: 400 });
  }

  after(async () => {
    try {
      await labRunSynthesisJob(pending.job_id);
      await labApplyPendingJobByLabId(lab_id);
    } catch (e) {
      console.error("[lab-jobs/synthesis] kick failed", e);
      try {
        await labApplyPendingJobByLabId(lab_id);
      } catch (applyErr) {
        console.error("[lab-jobs/synthesis] apply-after-fail also failed", applyErr);
      }
    }
  });

  await appendLabAudit({
    ops_user: auth.username,
    lab_id,
    action: "pipeline_synthesis_kick",
    detail: pending.job_id,
  });

  return NextResponse.json({ ok: true, lab: labPublicView(lab), job_id: pending.job_id });
}
