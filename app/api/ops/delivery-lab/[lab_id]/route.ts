import { NextResponse } from "next/server";
import { loadDeliveryLab } from "@/lib/llm/pro/delivery/lab/store";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import { labApplyPendingJobByLabId } from "@/lib/llm/pro/delivery/lab/pipeline-jobs";
import { requireOpsUser } from "@/lib/ops/require-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ lab_id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireOpsUser();
  if (!auth.ok) return auth.response;

  const { lab_id } = await ctx.params;
  if (!lab_id?.trim()) {
    return NextResponse.json({ ok: false, error: "need_lab_id" }, { status: 400 });
  }

  const id = lab_id.trim();
  let lab = await loadDeliveryLab(id);
  if (!lab) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Full-page refresh must reconcile completed Stage2/Synthesis jobs → unlock delivery.
  if (lab.mode === "full_pipeline" && lab.pipeline_pending_job) {
    try {
      const applied = await labApplyPendingJobByLabId(id);
      if (applied) lab = applied;
    } catch (e) {
      console.warn("[delivery-lab GET] pending job reconcile failed", {
        lab_id: id,
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ ok: true, lab: labPublicView(lab) });
}
