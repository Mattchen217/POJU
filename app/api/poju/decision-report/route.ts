import { after, NextResponse } from "next/server";

import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import type { DeliveryPipelineStage } from "@/lib/llm/pro/delivery/delivery-stage-store";
import { chargeDeliveryPass } from "@/lib/passes/charge-delivery-pass";
import { runDecisionReportStage } from "@/lib/poju/decision-intake/decision-report-runner";
import {
  abortDecisionReportJob,
  buildDecisionReportStatus,
  continueDecisionReportJob,
  startDecisionReportJob,
  type ServiceFailure,
} from "@/lib/poju/decision-intake/decision-report-service";
import { releaseXhighSessionLock, updateXhighJobStatus } from "@/lib/poju/xhigh-job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function str(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function failureResponse(f: ServiceFailure) {
  return NextResponse.json(
    { ok: false, error: f.error, code: f.code, retryable: f.retryable },
    { status: f.status },
  );
}

/** Same relay entry as the legacy book: Inngest when available, else after(). */
async function scheduleDecisionReport(
  job_id: string,
  session_id: string,
  stage: DeliveryPipelineStage,
): Promise<void> {
  await updateXhighJobStatus(job_id, "pending", {
    current_stage: stage,
    accumulated_content: `queued:${stage}:${Date.now()}`,
  }).catch(() => undefined);
  const { shouldDispatchContinueViaInngest, publishContinueViaInngest, waitForDeliveryWorker } =
    await import("@/lib/poju/delivery-continue-dispatch");
  if (shouldDispatchContinueViaInngest()) {
    const published = await publishContinueViaInngest(job_id, stage);
    if (published === "published") {
      if (await waitForDeliveryWorker(job_id, stage, 30_000)) return;
      console.warn("[decision-report] Inngest published but no worker attached — after()", { job_id });
    }
  }
  after(async () => {
    try {
      await runDecisionReportStage(job_id, stage);
    } catch (e) {
      console.error("[decision-report] background stage failed", e);
      await releaseXhighSessionLock("decision_report", session_id).catch(() => undefined);
    }
  });
}

/**
 * Decision Intake 2.0 report — Freeze → Personal Analysis → eight pages.
 *   action=start     verify server Freeze + profile receipts, create/reuse job (regenerate=true → new generation)
 *   action=status    job + analysis + per-page checkpoints (client mirrors into its session)
 *   action=continue  resume an interrupted job from its checkpoints
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = str(body.action);
    const session_id = str(body.session_id);
    if (!session_id) {
      return NextResponse.json({ ok: false, error: "session_id required" }, { status: 400 });
    }

    if (action === "status") {
      const job_id = str(body.job_id);
      if (!job_id) return NextResponse.json({ ok: false, error: "job_id required" }, { status: 400 });
      return NextResponse.json(await buildDecisionReportStatus({ job_id, session_id }));
    }

    if (!isOpenRouterConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OpenRouter is not configured (OPENROUTER_API_KEY)." },
        { status: 503 },
      );
    }

    if (action === "continue") {
      const job_id = str(body.job_id);
      if (!job_id) return NextResponse.json({ ok: false, error: "job_id required" }, { status: 400 });
      const cont = await continueDecisionReportJob({ job_id, session_id });
      if (!cont.ok) return failureResponse(cont);
      await scheduleDecisionReport(cont.job.job_id, session_id, cont.stage);
      return NextResponse.json({ ok: true, job_id: cont.job.job_id, status: "running", stage: cont.stage });
    }

    if (action === "start") {
      const regenerate = body.regenerate === true;
      const started = await startDecisionReportJob({
        session_id,
        locale: str(body.locale) || "zh",
        writer_token: body.writer_token ?? null,
        freeze_receipt: body.freeze_receipt ?? null,
        profile_receipt: body.profile_receipt ?? null,
        regenerate,
      });
      if (!started.ok) return failureResponse(started);
      if (started.reused) {
        return NextResponse.json({
          ok: true,
          job_id: started.job.job_id,
          status: started.job.status,
          reused: true,
        });
      }
      // Regenerate is free only when this session already ran a report.
      if (!regenerate || !started.had_prior_job) {
        const charged = await chargeDeliveryPass({
          sessionId: session_id,
          question: started.question,
          jointPassRef: str(body.joint_pass_ref) || null,
        });
        if (!charged.ok) {
          await abortDecisionReportJob(started.job, "pass_required");
          return charged.response;
        }
      }
      await scheduleDecisionReport(started.job.job_id, session_id, "finalize");
      return NextResponse.json({
        ok: true,
        job_id: started.job.job_id,
        status: "pending",
        reused: false,
        execution_generation: started.job.execution_generation ?? null,
      });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e) {
    console.error("[decision-report]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "decision report request failed" },
      { status: 500 },
    );
  }
}
