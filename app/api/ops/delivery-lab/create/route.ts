import { NextResponse } from "next/server";
import { createDeliveryLab, appendLabAudit } from "@/lib/llm/pro/delivery/lab/store";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import { sanitizeLabDeliverySource } from "@/lib/llm/pro/delivery/lab/sanitize-delivery-source";
import type { LabSource } from "@/lib/llm/pro/delivery/lab/types";
import { requireOpsUser } from "@/lib/ops/require-ops";
import { coerceBirthInfo } from "@/lib/ziwei/lab-ziwei";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CreateBody = {
  locale?: string;
  original_question?: string;
  desired_outcome?: string;
  base_analysis?: unknown;
  /** Same BirthInfo as bazi clock — required for ZiweiFactPack on Lab guns. */
  birth_info?: unknown;
  breakthrough_core?: unknown | null;
  covered_agenda?: LabSource["covered_agenda"];
  session_id?: string;
  question_category?: string | null;
  /** full_pipeline = Stage1–3 chat then unlock delivery; omit = delivery-only. */
  mode?: "delivery_only" | "full_pipeline";
  selected_stored_profile_id?: string | null;
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

  const mode = body.mode === "full_pipeline" ? "full_pipeline" : "delivery_only";
  const original_question =
    typeof body.original_question === "string" ? body.original_question.trim() : "";
  // Delivery-only still needs a question; full_pipeline may start empty and fill via chat.
  if (mode === "delivery_only" && original_question.length < 2) {
    return NextResponse.json({ ok: false, error: "need_original_question" }, { status: 400 });
  }
  if (body.base_analysis == null || typeof body.base_analysis !== "object") {
    return NextResponse.json({ ok: false, error: "need_base_analysis_object" }, { status: 400 });
  }

  const clean = sanitizeLabDeliverySource({
    base_analysis: body.base_analysis,
    breakthrough_core: body.breakthrough_core ?? null,
  });
  if (!clean.base_analysis.structured) {
    return NextResponse.json(
      { ok: false, error: "need_structured_after_sanitize" },
      { status: 400 },
    );
  }

  try {
    const lab = await createDeliveryLab({
      ops_user: auth.username,
      mode,
      selected_stored_profile_id:
        typeof body.selected_stored_profile_id === "string"
          ? body.selected_stored_profile_id.trim()
          : null,
      source: {
        locale: (body.locale ?? "zh").trim() || "zh",
        original_question:
          original_question.length >= 2 ? original_question : "(lab pipeline)",
        desired_outcome:
          typeof body.desired_outcome === "string" ? body.desired_outcome.trim() : undefined,
        base_analysis: clean.base_analysis,
        birth_info: coerceBirthInfo(body.birth_info),
        breakthrough_core: mode === "full_pipeline" ? null : clean.breakthrough_core,
        covered_agenda:
          mode === "full_pipeline"
            ? []
            : Array.isArray(body.covered_agenda)
              ? body.covered_agenda
              : [],
        session_id: typeof body.session_id === "string" ? body.session_id.trim() : undefined,
        question_category:
          typeof body.question_category === "string" && body.question_category.trim()
            ? body.question_category.trim()
            : body.question_category === null
              ? null
              : undefined,
      },
    });
    await appendLabAudit({
      ops_user: auth.username,
      lab_id: lab.lab_id,
      action: mode === "full_pipeline" ? "create_full_pipeline" : "create",
      detail: clean.stripped.length ? `stripped=${clean.stripped.length}` : undefined,
    });
    return NextResponse.json({
      ok: true,
      lab: labPublicView(lab),
      stripped: clean.stripped,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "create_failed" },
      { status: 500 },
    );
  }
}
