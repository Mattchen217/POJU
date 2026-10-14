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
  labDyadCollect,
  labDyadSkip,
  labForceUnlockDelivery,
  labRunSegment2AJob,
  labRunSynthesisJob,
  labSynthesisConfirm,
  labUnderstandingConfirm,
} from "@/lib/llm/pro/delivery/lab/pipeline-jobs";
import { labContinueAfterDyadGate } from "@/lib/llm/pro/delivery/lab/pipeline-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  action?:
    | "understanding_confirm"
    | "dyad_skip"
    | "dyad_collect"
    | "synthesis_confirm"
    | "unlock_delivery";
  partner_base_analysis?: unknown;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ lab_id: string }> },
) {
  const auth = await requireOpsUser();
  if (!auth.ok) return auth.response;

  const { lab_id } = await ctx.params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const lab = await loadDeliveryLab(lab_id);
  if (!lab) {
    return NextResponse.json({ ok: false, error: "lab_not_found" }, { status: 404 });
  }
  if (lab.mode !== "full_pipeline") {
    return NextResponse.json({ ok: false, error: "not_full_pipeline" }, { status: 400 });
  }

  try {
    if (body.action === "dyad_skip") {
      const patched = await labDyadSkip(lab);
      // Persist lock + UI clear first so a continue failure still leaves a usable lab.
      await saveDeliveryLab(patched);
      let next = patched;
      try {
        next = await labContinueAfterDyadGate(patched);
        await saveDeliveryLab(next);
      } catch (e) {
        console.error("[lab-gate] dyad_skip continue failed", e);
        await appendLabAudit({
          ops_user: auth.username,
          lab_id,
          action: "gate_dyad_skip",
          detail: `path=${patched.chat_session?.pivot_chart_path};continue_failed`,
        });
        return NextResponse.json(
          {
            ok: false,
            error: e instanceof Error ? e.message : "dyad_continue_failed",
            lab: labPublicView(patched),
          },
          { status: 500 },
        );
      }
      await appendLabAudit({ ops_user: auth.username, lab_id, action: "gate_dyad_skip" });
      return NextResponse.json({ ok: true, lab: labPublicView(next) });
    }

    if (body.action === "dyad_collect") {
      if (body.partner_base_analysis == null || typeof body.partner_base_analysis !== "object") {
        return NextResponse.json(
          { ok: false, error: "need_partner_base_analysis" },
          { status: 400 },
        );
      }
      const patched = await labDyadCollect(lab, body.partner_base_analysis);
      await saveDeliveryLab(patched);
      let next = patched;
      try {
        next = await labContinueAfterDyadGate(patched);
        await saveDeliveryLab(next);
      } catch (e) {
        console.error("[lab-gate] dyad_collect continue failed", e);
        await appendLabAudit({
          ops_user: auth.username,
          lab_id,
          action: "gate_dyad_collect",
          detail: `path=${patched.chat_session?.pivot_chart_path};continue_failed`,
        });
        return NextResponse.json(
          {
            ok: false,
            error: e instanceof Error ? e.message : "dyad_continue_failed",
            lab: labPublicView(patched),
          },
          { status: 500 },
        );
      }
      await appendLabAudit({ ops_user: auth.username, lab_id, action: "gate_dyad_collect" });
      return NextResponse.json({ ok: true, lab: labPublicView(next) });
    }

    if (body.action === "understanding_confirm") {
      const { lab: next, job_id } = await labUnderstandingConfirm(lab);
      await saveDeliveryLab(next);
      if (job_id) {
        after(async () => {
          try {
            await labRunSegment2AJob(job_id);
          } catch (e) {
            console.error("[lab-gate] segment2_a failed", e);
          }
        });
      }
      await appendLabAudit({
        ops_user: auth.username,
        lab_id,
        action: "gate_understanding_confirm",
        detail: job_id ? `job=${job_id}` : undefined,
      });
      return NextResponse.json({ ok: true, lab: labPublicView(next), job_id });
    }

    if (body.action === "unlock_delivery") {
      const next = await labForceUnlockDelivery(lab);
      await saveDeliveryLab(next);
      await appendLabAudit({
        ops_user: auth.username,
        lab_id,
        action: "gate_unlock_delivery",
        detail: next.pipeline_delivery_unlocked ? "unlocked" : "still_locked",
      });
      return NextResponse.json({ ok: true, lab: labPublicView(next) });
    }

    if (body.action === "synthesis_confirm") {
      const { lab: next, job_id } = await labSynthesisConfirm(lab);
      await saveDeliveryLab(next);
      if (job_id) {
        after(async () => {
          try {
            await labRunSynthesisJob(job_id);
            // Unlock delivery in KV even if the ops UI never successfully polls.
            await labApplyPendingJobByLabId(lab_id);
          } catch (e) {
            console.error("[lab-gate] synthesis failed", e);
            try {
              await labApplyPendingJobByLabId(lab_id);
            } catch (applyErr) {
              console.error("[lab-gate] synthesis apply-after-fail also failed", applyErr);
            }
          }
        });
      }
      await appendLabAudit({
        ops_user: auth.username,
        lab_id,
        action: "gate_synthesis_confirm",
        detail: job_id ? `job=${job_id}` : undefined,
      });
      return NextResponse.json({ ok: true, lab: labPublicView(next), job_id });
    }

    return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "gate_failed" },
      { status: 500 },
    );
  }
}
