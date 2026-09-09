import { NextResponse } from "next/server";
import { createDeliveryLab, appendLabAudit } from "@/lib/llm/pro/delivery/lab/store";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import type { LabSource } from "@/lib/llm/pro/delivery/lab/types";
import { requireOpsUser } from "@/lib/ops/require-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CreateBody = {
  locale?: string;
  original_question?: string;
  desired_outcome?: string;
  base_analysis?: unknown;
  breakthrough_core?: unknown | null;
  covered_agenda?: LabSource["covered_agenda"];
  session_id?: string;
};

export async function POST(req: Request) {
  const auth = await requireOpsUser();
  if (!auth.ok) return auth.response;

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const original_question =
    typeof body.original_question === "string" ? body.original_question.trim() : "";
  if (original_question.length < 2) {
    return NextResponse.json({ ok: false, error: "need_original_question" }, { status: 400 });
  }
  if (body.base_analysis == null || typeof body.base_analysis !== "object") {
    return NextResponse.json({ ok: false, error: "need_base_analysis_object" }, { status: 400 });
  }

  try {
    const lab = await createDeliveryLab({
      ops_user: auth.username,
      source: {
        locale: (body.locale ?? "zh").trim() || "zh",
        original_question,
        desired_outcome:
          typeof body.desired_outcome === "string" ? body.desired_outcome.trim() : undefined,
        base_analysis: body.base_analysis,
        breakthrough_core: body.breakthrough_core ?? null,
        covered_agenda: Array.isArray(body.covered_agenda) ? body.covered_agenda : [],
        session_id: typeof body.session_id === "string" ? body.session_id.trim() : undefined,
      },
    });
    await appendLabAudit({
      ops_user: auth.username,
      lab_id: lab.lab_id,
      action: "create",
    });
    return NextResponse.json({ ok: true, lab: labPublicView(lab) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "create_failed" },
      { status: 500 },
    );
  }
}
