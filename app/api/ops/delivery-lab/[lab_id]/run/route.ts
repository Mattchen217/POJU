import { after, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import {
  loadDeliveryLab,
  saveDeliveryLab,
  appendLabAudit,
} from "@/lib/llm/pro/delivery/lab/store";
import { runLabStep, type LabMarkOp } from "@/lib/llm/pro/delivery/lab/run-step";
import {
  isCompanionLlmBackgroundKind,
  markLabStepRunningV3,
  runLabStepV3,
} from "@/lib/llm/pro/delivery/lab/run-step-v3";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import { labV3StepDef } from "@/lib/llm/pro/delivery/lab/types-v3";
import {
  LAB_COMPANION_BG_HEADER,
  companionBgSecret,
  publishCompanionBgViaQStash,
} from "@/lib/llm/pro/delivery/lab/companion-bg-dispatch";
import { continueOrigin } from "@/lib/poju/delivery-continue-dispatch";
import { requireOpsUser } from "@/lib/ops/require-ops";
import type { LabAttempt } from "@/lib/llm/pro/delivery/lab/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** One Lab run = one dispatch unit. Write steps chain chunk-per-POST (270s each). */
export const maxDuration = 300;

type Ctx = { params: Promise<{ lab_id: string }> };

async function failCompanionRunning(
  labId: string,
  step_key: string,
  msg: string,
): Promise<void> {
  const fresh = await loadDeliveryLab(labId).catch(() => null);
  if (!fresh) return;
  const rec = fresh.steps[step_key];
  if (!rec || rec.status !== "running") return;
  const attempt: LabAttempt = {
    attempt_number: rec.attempts.length + 1,
    timestamp: new Date().toISOString(),
    duration_ms: 0,
    input_payload: { step_key, companion_enqueue: true },
    raw_model_output: null,
    processing_actions: [],
    gate_verdict: { passed: false, failed_rule: "exception", detail: msg },
    output_to_next_stage: null,
    error: msg,
  };
  rec.attempts.push(attempt);
  rec.status = "failed";
  fresh.steps[step_key] = rec;
  await saveDeliveryLab(fresh).catch(() => undefined);
}

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

  const mark_op = body.mark_op;
  const mark_chunk =
    typeof body.mark_chunk === "number" && Number.isFinite(body.mark_chunk)
      ? Math.max(0, Math.floor(body.mark_chunk))
      : undefined;

  const day_index =
    typeof body.day_index === "number" && Number.isFinite(body.day_index)
      ? Math.max(0, Math.min(29, Math.floor(body.day_index)))
      : undefined;

  const v3Opts = {
    polish_locale: body.polish_locale,
    skip_polish: Boolean(body.skip_polish),
    day_index,
  };

  /**
   * Companion pair must not hold the browser HTTP socket open.
   * Idle gateway 504 kills the isolate → our OR fetch aborts as llm_timeout while
   * OpenRouter still finishes and bills. Return pending; work on a detached lifetime.
   */
  if (lab.pipeline === "v3_three_step") {
    const def = labV3StepDef(step_key);
    if (isCompanionLlmBackgroundKind(def?.kind)) {
      const locked = await markLabStepRunningV3(lab, step_key);
      if (!locked.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: locked.reason,
            lab: labPublicView(locked.lab),
          },
          { status: 400 },
        );
      }

      const labId = locked.lab.lab_id;
      const payload = {
        lab_id: labId,
        step_key,
        polish_locale: body.polish_locale,
        skip_polish: Boolean(body.skip_polish),
        day_index,
      };

      const q = await publishCompanionBgViaQStash(payload);
      let dispatch: "qstash" | "after" | "local_bg" = "after";

      if (q === "published") {
        dispatch = "qstash";
      } else if (process.env.VERCEL === "1") {
        /** Production without QStash: after() survives the closed browser socket. */
        after(async () => {
          try {
            const fresh = await loadDeliveryLab(labId);
            if (!fresh) return;
            await runLabStepV3(fresh, step_key, {
              ...v3Opts,
              resume_background: true,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("[delivery-lab] companion after() failed:", msg);
            await failCompanionRunning(labId, step_key, msg);
          }
        });
        dispatch = "after";
      } else {
        /** Local dev: separate companion-bg invoke (no Vercel 508 self-fetch risk). */
        const origin = continueOrigin() ?? "http://127.0.0.1:3000";
        const secret = companionBgSecret();
        if (!secret) {
          await failCompanionRunning(labId, step_key, "ops_session_secret_missing");
          return NextResponse.json(
            {
              ok: false,
              error: "ops_session_secret_missing",
              lab: labPublicView(locked.lab),
            },
            { status: 503 },
          );
        }
        waitUntil(
          fetch(
            `${origin}/api/ops/delivery-lab/${encodeURIComponent(labId)}/companion-bg`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                [LAB_COMPANION_BG_HEADER]: secret,
                Connection: "close",
              },
              body: JSON.stringify(payload),
            },
          )
            .then(async (res) => {
              if (!res.ok) {
                const t = await res.text().catch(() => "");
                await failCompanionRunning(
                  labId,
                  step_key,
                  `companion_bg_http_${res.status}:${t.slice(0, 120)}`,
                );
              }
            })
            .catch(async (e) => {
              const msg = e instanceof Error ? e.message : String(e);
              await failCompanionRunning(labId, step_key, msg);
            }),
        );
        dispatch = "local_bg";
      }

      await appendLabAudit({
        ops_user: auth.username,
        lab_id: labId,
        action: "run",
        detail: `${step_key}:companion_${dispatch}:${day_index != null ? `day_${day_index}` : "auto"}:pending`,
      });

      return NextResponse.json({
        ok: true,
        pending: true,
        dispatch,
        lab: labPublicView(locked.lab),
      });
    }
  }

  const result =
    lab.pipeline === "v3_three_step"
      ? await runLabStepV3(lab, step_key, v3Opts)
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
