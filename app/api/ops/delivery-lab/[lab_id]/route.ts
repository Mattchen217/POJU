import { NextResponse } from "next/server";
import { loadDeliveryLab } from "@/lib/llm/pro/delivery/lab/store";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import { requireOpsUser } from "@/lib/ops/require-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ lab_id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireOpsUser();
  if (!auth.ok) return auth.response;

  const { lab_id } = await ctx.params;
  if (!lab_id?.trim()) {
    return NextResponse.json({ ok: false, error: "need_lab_id" }, { status: 400 });
  }

  const lab = await loadDeliveryLab(lab_id.trim());
  if (!lab) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lab: labPublicView(lab) });
}
