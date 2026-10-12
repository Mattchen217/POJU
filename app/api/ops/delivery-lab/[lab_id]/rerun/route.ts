import { NextResponse } from "next/server";
import { loadDeliveryLab, appendLabAudit } from "@/lib/llm/pro/delivery/lab/store";
import { prepareLabRerun } from "@/lib/llm/pro/delivery/lab/run-step";
import { prepareLabRerunV3 } from "@/lib/llm/pro/delivery/lab/run-step-v3";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import { requireOpsUser } from "@/lib/ops/require-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ lab_id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireOpsUser();
  if (!auth.ok) return auth.response;

  const { lab_id } = await ctx.params;
  let body: {
    stage_id?: string;
    step_key?: string;
    /** 人手准备重跑：清空 companion 当前选中双日。504 自动解锁勿传。 */
    clear_companion_pair?: boolean;
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

  const clearPair =
    body.clear_companion_pair === true &&
    typeof body.day_index === "number" &&
    Number.isFinite(body.day_index)
      ? Math.max(0, Math.min(29, Math.floor(body.day_index)))
      : undefined;

  const result =
    lab.pipeline === "v3_three_step"
      ? await prepareLabRerunV3(lab, step_key, {
          clear_companion_pair_day_index: clearPair,
        })
      : await prepareLabRerun(lab, step_key);
  await appendLabAudit({
    ops_user: auth.username,
    lab_id: lab.lab_id,
    action: "rerun_prepare",
    detail: `${step_key}:${result.ok ? "ok" : result.reason}${clearPair != null ? `:clear_pair_${clearPair}` : ""}`,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.reason, lab: labPublicView(result.lab) },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, lab: labPublicView(result.lab) });
}
