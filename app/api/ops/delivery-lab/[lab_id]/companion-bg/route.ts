import { NextResponse } from "next/server";
import { loadDeliveryLab, saveDeliveryLab } from "@/lib/llm/pro/delivery/lab/store";
import { runLabStepV3 } from "@/lib/llm/pro/delivery/lab/run-step-v3";
import {
  LAB_COMPANION_BG_HEADER,
  verifyCompanionBgSecret,
} from "@/lib/llm/pro/delivery/lab/companion-bg-dispatch";
import type { LabAttempt } from "@/lib/llm/pro/delivery/lab/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Fresh invoke — independent of the browser /run connection. */
export const maxDuration = 300;

type Ctx = { params: Promise<{ lab_id: string }> };

/**
 * Internal worker for Companion pair LLM.
 * Auth: x-lab-companion-bg = OPS_SESSION_SECRET (QStash forward or local kick).
 */
export async function POST(req: Request, ctx: Ctx) {
  if (!verifyCompanionBgSecret(req.headers.get(LAB_COMPANION_BG_HEADER))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { lab_id: labIdParam } = await ctx.params;
  let body: {
    lab_id?: string;
    step_key?: string;
    polish_locale?: string;
    skip_polish?: boolean;
    day_index?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const lab_id = (body.lab_id ?? labIdParam).trim();
  const step_key = (body.step_key ?? "").trim();
  if (!lab_id || !step_key) {
    return NextResponse.json({ ok: false, error: "need_lab_step" }, { status: 400 });
  }

  const day_index =
    typeof body.day_index === "number" && Number.isFinite(body.day_index)
      ? Math.max(0, Math.min(29, Math.floor(body.day_index)))
      : undefined;

  try {
    const lab = await loadDeliveryLab(lab_id);
    if (!lab) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const result = await runLabStepV3(lab, step_key, {
      polish_locale: body.polish_locale,
      skip_polish: Boolean(body.skip_polish),
      day_index,
      resume_background: true,
    });

    return NextResponse.json({
      ok: result.ok,
      error: result.ok ? undefined : result.reason,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[lab-companion-bg] failed:", msg);
    const fresh = await loadDeliveryLab(lab_id).catch(() => null);
    if (fresh?.steps[step_key]?.status === "running") {
      const rec = fresh.steps[step_key]!;
      const attempt: LabAttempt = {
        attempt_number: rec.attempts.length + 1,
        timestamp: new Date().toISOString(),
        duration_ms: 0,
        input_payload: { step_key, companion_bg: true },
        raw_model_output: null,
        processing_actions: [],
        gate_verdict: {
          passed: false,
          failed_rule: "exception",
          detail: msg,
        },
        output_to_next_stage: null,
        error: msg,
      };
      rec.attempts.push(attempt);
      rec.status = "failed";
      fresh.steps[step_key] = rec;
      await saveDeliveryLab(fresh).catch(() => undefined);
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
