import { NextResponse } from "next/server";
import { loadDeliveryLab, appendLabAudit } from "@/lib/llm/pro/delivery/lab/store";
import { runLabStep } from "@/lib/llm/pro/delivery/lab/run-step";
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
  let body: { stage_id?: string; step_key?: string };
  try {
    body = (await req.json()) as { stage_id?: string; step_key?: string };
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

  const result = await runLabStep(lab, step_key);
  await appendLabAudit({
    ops_user: auth.username,
    lab_id: lab.lab_id,
    action: "run",
    detail: `${step_key}:${result.ok ? "ok" : result.reason}`,
  });

  return NextResponse.json({
    ok: result.ok,
    error: result.ok ? undefined : result.reason,
    attempt: result.attempt ?? null,
    lab: labPublicView(result.lab),
  });
}
