import { NextResponse } from "next/server";
import { requireOpsUser } from "@/lib/ops/require-ops";
import {
  appendLabAudit,
  loadDeliveryLab,
  saveDeliveryLab,
} from "@/lib/llm/pro/delivery/lab/store";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import { rerunLabPipelineLastChatTurn } from "@/lib/llm/pro/delivery/lab/pipeline-chat";

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
    const next = await rerunLabPipelineLastChatTurn(lab);
    await saveDeliveryLab(next);
    await appendLabAudit({
      ops_user: auth.username,
      lab_id,
      action: "pipeline_chat_rerun",
    });
    return NextResponse.json({ ok: true, lab: labPublicView(next) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "rerun_failed" },
      { status: 500 },
    );
  }
}
