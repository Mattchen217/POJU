import { after, NextResponse } from "next/server";
import { requireOpsUser } from "@/lib/ops/require-ops";
import {
  appendLabAudit,
  loadDeliveryLab,
  saveDeliveryLab,
} from "@/lib/llm/pro/delivery/lab/store";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import {
  labPollPipelineJob,
  labRunSegment2AJob,
  labRunSegment2BJob,
} from "@/lib/llm/pro/delivery/lab/pipeline-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET — poll pending segment2 job and apply when complete (auto-starts Call B after A).
 * POST — re-kick runner for pending segment2 job (if stalled).
 */
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
      await saveDeliveryLab(next);
      // If Call B was just created, schedule it.
      if (
        next.pipeline_pending_job?.stage === "segment2_b" &&
        lab.pipeline_pending_job?.stage === "segment2_a"
      ) {
        const job_id = next.pipeline_pending_job.job_id;
        after(async () => {
          try {
            await labRunSegment2BJob(job_id);
          } catch (e) {
            console.error("[lab-jobs/segment2] Call B failed", e);
          }
        });
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
  if (!pending || (pending.stage !== "segment2_a" && pending.stage !== "segment2_b")) {
    return NextResponse.json({ ok: false, error: "no_segment2_pending" }, { status: 400 });
  }

  after(async () => {
    try {
      if (pending.stage === "segment2_a") await labRunSegment2AJob(pending.job_id);
      else await labRunSegment2BJob(pending.job_id);
    } catch (e) {
      console.error("[lab-jobs/segment2] kick failed", e);
    }
  });

  await appendLabAudit({
    ops_user: auth.username,
    lab_id,
    action: "pipeline_segment2_kick",
    detail: `${pending.stage}:${pending.job_id}`,
  });

  return NextResponse.json({ ok: true, lab: labPublicView(lab), job_id: pending.job_id });
}
