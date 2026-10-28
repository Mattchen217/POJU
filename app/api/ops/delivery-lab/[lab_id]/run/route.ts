import { NextResponse } from "next/server";
import { loadDeliveryLab, appendLabAudit } from "@/lib/llm/pro/delivery/lab/store";
import { runLabStep, type LabMarkOp } from "@/lib/llm/pro/delivery/lab/run-step";
import { runLabStepV3 } from "@/lib/llm/pro/delivery/lab/run-step-v3";
import { labUsesV3Executor } from "@/lib/llm/pro/delivery/lab/pipeline-stamp";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import { requireOpsUser } from "@/lib/ops/require-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** One Lab run = one dispatch unit. Write steps chain chunk-per-POST (270s each). */
export const maxDuration = 300;

type Ctx = { params: Promise<{ lab_id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireOpsUser();
  if (!auth.ok) return auth.response;

  const { lab_id } = await ctx.params;
  let body: {
    stage_id?: string;
    step_key?: string;
    mark_op?: LabMarkOp;
    mark_chunk?: number;
    polish_locale?: string;
    skip_polish?: boolean;
    day_index?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const step_key = (body.stage_id ?? body.step_key ?? "").trim();
  if (!step_key) {
    return NextResponse.json({ ok: false, error: "need_stage_id" }, { status: 400 });
  }

  const lab = await loadDeliveryLab(lab_id.trim());
  if (!lab) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (lab.mode === "full_pipeline" && !lab.pipeline_delivery_unlocked) {
    return NextResponse.json(
      { ok: false, error: "pipeline_delivery_locked" },
      { status: 423 },
    );
  }

  const mark_op = body.mark_op;
  const mark_chunk =
    typeof body.mark_chunk === "number" && Number.isFinite(body.mark_chunk)
      ? Math.max(0, Math.floor(body.mark_chunk))
      : undefined;

  const day_index =
    typeof body.day_index === "number" && Number.isFinite(body.day_index)
      ? Math.max(0, Math.min(29, Math.floor(body.day_index)))
      : undefined;

  const result = labUsesV3Executor(lab.pipeline)
    ? await runLabStepV3(lab, step_key, {
        polish_locale: body.polish_locale,
        skip_polish: Boolean(body.skip_polish),
        day_index,
      })
    : await runLabStep(lab, step_key, {
        mark_op,
        mark_chunk,
      });
  await appendLabAudit({
    ops_user: auth.username,
    lab_id: lab.lab_id,
    action: "run",
    detail: `${step_key}:${body.skip_polish ? "skip_polish" : day_index != null ? `day_${day_index}` : body.polish_locale ?? mark_op ?? "auto"}:${result.ok ? "ok" : result.reason}`,
  });

  return NextResponse.json({
    ok: result.ok,
    error: result.ok ? undefined : result.reason,
    attempt: result.attempt ?? null,
    lab: labPublicView(result.lab),
  });
}
