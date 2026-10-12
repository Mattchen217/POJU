import { NextResponse } from "next/server";
import { loadDeliveryLab, appendLabAudit } from "@/lib/llm/pro/delivery/lab/store";
import { runLabStep, type LabMarkOp } from "@/lib/llm/pro/delivery/lab/run-step";
import {
  isCompanionLlmBackgroundKind,
  runLabStepV3,
} from "@/lib/llm/pro/delivery/lab/run-step-v3";
import { labPublicView } from "@/lib/llm/pro/delivery/lab/public-view";
import { labV3StepDef } from "@/lib/llm/pro/delivery/lab/types-v3";
import { requireOpsUser } from "@/lib/ops/require-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** One Lab run = one dispatch unit. Write steps chain chunk-per-POST (270s each). */
export const maxDuration = 300;

type Ctx = { params: Promise<{ lab_id: string }> };

type RunBody = {
  stage_id?: string;
  step_key?: string;
  mark_op?: LabMarkOp;
  mark_chunk?: number;
  polish_locale?: string;
  skip_polish?: boolean;
  day_index?: number;
};

/**
 * Companion pair LLM often sits silent 60–90s before the first byte.
 * Idle proxies then 504 while OpenRouter still finishes (billed, no write-back).
 * SSE comments every few seconds keep the gateway awake; final `data:` carries JSON.
 */
function companionRunSse(work: () => Promise<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* client gone — keep work running for KV write */
        }
      };
      const heartbeat = setInterval(() => {
        push(`: hb ${Date.now()}\n\n`);
      }, 8_000);
      push(`: companion-sse-start\n\n`);
      try {
        const payload = await work();
        push(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        push(`data: ${JSON.stringify({ ok: false, error: msg })}\n\n`);
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireOpsUser();
  if (!auth.ok) return auth.response;

  const { lab_id } = await ctx.params;
  let body: RunBody;
  try {
    body = (await req.json()) as RunBody;
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

  const companionSse =
    lab.pipeline === "v3_three_step" &&
    isCompanionLlmBackgroundKind(labV3StepDef(step_key)?.kind);

  if (companionSse) {
    return companionRunSse(async () => {
      const result = await runLabStepV3(lab, step_key, v3Opts);
      await appendLabAudit({
        ops_user: auth.username,
        lab_id: lab.lab_id,
        action: "run",
        detail: `${step_key}:companion_sse:${day_index != null ? `day_${day_index}` : body.polish_locale ?? "auto"}:${result.ok ? "ok" : result.reason}`,
      });
      return {
        ok: result.ok,
        error: result.ok ? undefined : result.reason,
        attempt: result.attempt ?? null,
        lab: labPublicView(result.lab),
      };
    });
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
