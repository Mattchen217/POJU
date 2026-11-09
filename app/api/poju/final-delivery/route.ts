import { after, NextResponse } from "next/server";

import {
  resolveDeliveryMode,
} from "@/lib/llm/pro/final-delivery";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { normalizeAgentPhase } from "@/lib/poju/agent-state";
import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { isPassEnforceEnabled } from "@/lib/passes/consume-pass";
import { consumePassSmart } from "@/lib/passes/consume-pass-smart";
import { passUsageTopicFromQuestion } from "@/lib/passes/pass-usage-label";
import { isUpstashPlanLimitError } from "@/lib/kv/upstash-plan-limit";
import { runFinalDeliveryJob } from "@/lib/poju/final-delivery-job-runner";
import { runWithEphemeralXhighKv } from "@/lib/poju/xhigh-job-store";
import {
  forceReleaseDeliveryContinueLease,
  loadAllDeliverySegmentReady,
  resetDeliverySegmentTransportFailCounts,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import { logDeliveryStep } from "@/lib/llm/pro/delivery/delivery-step-log";
import { isProductionV3ClosedFailure } from "@/lib/llm/pro/delivery/pipeline-v3/flag";
import {
  acquireXhighSessionLock,
  createXhighJob,
  failXhighJob,
  findLatestXhighJobForSession,
  getXhighJob,
  releaseXhighSessionLock,
  updateXhighJobStatus,
} from "@/lib/poju/xhigh-job-store";
import {
  isFinalDeliveryJobInput,
  isFinalDeliveryJobResult,
  type FinalDeliveryJobInput,
  type PojuXhighJob,
} from "@/lib/poju/xhigh-job-types";
import {
  currentDeliveryDeployGeneration,
  isDeliveryJobFromCurrentDeploy,
} from "@/lib/poju/delivery-deploy-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Only allow a new job when the previous non-terminal job is already dead
 * (status route will STOP it). Do not spawn a parallel chain on clock alone.
 */
const STALE_RUNNING_MS = 45_000;

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function isLooseAgentState(x: unknown): x is POJUAgentState {
  if (!isRecord(x)) return false;
  if (typeof x.current_phase !== "string" || !normalizeAgentPhase(x.current_phase)) return false;
  if (typeof x.original_question !== "string") return false;
  if (!isRecord(x.context_collected)) return false;
  return true;
}

function isBreakthroughCore(x: unknown): x is BreakthroughCore {
  if (!isRecord(x)) return false;
  if (typeof x.situation_conclusion !== "string") return false;
  if (!Array.isArray(x.modern_action_frames)) return false;
  if (!isRecord(x.key_crossroads)) return false;
  if (!isRecord(x.energy_retune_frame)) return false;
  if (!isRecord(x.rhythm_frame)) return false;
  if (!Array.isArray(x.self_check_signals)) return false;
  return true;
}

async function jobStatusResponse(job: PojuXhighJob) {
  if (job.status === "completed" && isFinalDeliveryJobResult(job.result)) {
    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      current_stage: "completed",
      full_text: job.result.full_text,
      actions: job.result.actions,
      model: job.result.model ?? job.model,
      tokens_used: job.result.tokens_used ?? job.tokens_used ?? 0,
      llm_debug: job.result.llm_debug ?? job.llm_debug,
      timings: job.result.timings,
      cost_usd: 0,
    });
  }
  if (job.status === "failed") {
    const retryable = job.retryable === true || job.failure_reason === "interrupted";
    const ready = await loadAllDeliverySegmentReady(job.job_id);
    const streamed_segments = ready.map((s) => ({
      key: s.key,
      heading: s.heading,
      body: s.body_markdown,
      evidence: s.evidence_markdown,
      interleaved: s.interleaved_markdown ?? "",
      evidence_ready: s.evidence_ready,
      page_schema: s.page_schema ?? undefined,
    }));
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: job.status,
      current_stage: job.current_stage ?? null,
      retryable,
      interrupted: retryable && job.failure_reason === "interrupted",
      reason: job.failure_reason ?? "transport_error",
      error: job.error ?? "final delivery job failed",
      streamed_segments: streamed_segments.length ? streamed_segments : undefined,
    });
  }
  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    status: job.status,
    current_stage: job.current_stage ?? "finalize",
    accumulated_content: job.accumulated_content,
  });
}

async function chargeDeliveryPass(input: {
  sessionId: string;
  question: string;
  jointPassRef: string | null;
}): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (!isPassEnforceEnabled("pivot") || !isSupabaseConfigured()) return { ok: true };
  const user = await getServerUser();
  if (!user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "pass_login_required", reason: "unauthorized" },
        { status: 401 },
      ),
    };
  }
  const consumed = await consumePassSmart({
    userId: user.id,
    product: "pivot",
    refId: input.jointPassRef || input.sessionId,
    description: passUsageTopicFromQuestion(input.question),
  });
  if (!consumed.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "pass_required",
          reason: consumed.reason ?? "insufficient_balance",
          balance_after: consumed.balanceAfter ?? 0,
        },
        { status: 402 },
      ),
    };
  }
  return { ok: true };
}

async function scheduleFinalDeliveryJob(job_id: string, session_id: string): Promise<void> {
  const { shouldDispatchContinueViaInngest, publishContinueViaInngest } = await import(
    "@/lib/poju/delivery-continue-dispatch"
  );
  // Stamp the queued stage so status does not treat a brand-new job as an unknown dead invoke.
  await updateXhighJobStatus(job_id, "pending", {
    current_stage: "finalize",
    accumulated_content: `queued:finalize:${Date.now()}`,
  }).catch(() => undefined);
  if (shouldDispatchContinueViaInngest()) {
    const { waitForDeliveryWorker } = await import("@/lib/poju/delivery-continue-dispatch");
    const published = await publishContinueViaInngest(job_id, "finalize");
    if (published === "published") {
      // Send succeeding is not a worker. If nothing attaches, run the stage here.
      const attached = await waitForDeliveryWorker(job_id, "finalize", 30_000);
      if (attached) return;
      console.warn(
        "[final-delivery] Inngest published but no worker attached — falling back to after()",
        { job_id },
      );
    } else {
      console.warn("[final-delivery] Inngest start failed — falling back to after()", {
        job_id,
      });
    }
  }
  after(async () => {
    try {
      // Runs first incomplete stage, then self-schedules the rest via continue hops.
      await runFinalDeliveryJob(job_id);
    } catch (e) {
      console.error("[final-delivery] background job failed:", e);
      await releaseXhighSessionLock("final_delivery", session_id);
    }
  });
}

/**
 * Phase 4 delivery 鈥?async xhigh job (same durability pattern as segment2).
 * POST creates/resumes a job; `after()` runs the multi-task pipeline even if the client leaves.
 * Poll GET /api/poju/final-delivery/status?job_id=鈥?or POST with resume_job_id.
 */
export async function POST(req: Request) {
  let inlineCall: (() => Promise<NextResponse>) | null = null;
  try {
    if (!isOpenRouterConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OpenRouter is not configured (OPENROUTER_API_KEY)." },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      session_id?: unknown;
      agent_v2?: unknown;
      locale?: unknown;
      base_analysis?: unknown;
      breakthrough_core?: unknown;
      covered_agenda?: unknown;
      recent_user_messages?: unknown;
      delivery_mode?: unknown;
      regenerate?: unknown;
      resume_job_id?: unknown;
      /** When true, only look up latest job for session (no create). */
      resume_latest?: unknown;
      /** User Continue after interrupted segment transport pause. */
      continue_interrupted?: unknown;
      job_id?: unknown;
      dyad_compat_summary?: unknown;
      partner_bazi?: unknown;
      pivot_chart_path?: unknown;
      dyad_matrix_pack?: unknown;
      joint_decision?: unknown;
      joint_pass_ref?: unknown;
      /** Product Stage 4 — frozen DC binding / snapshot / session slice. */
      decision_context_binding?: unknown;
      decision_context_snapshot?: unknown;
      decision_context?: unknown;
      decision_context_versions?: unknown;
      require_decision_context?: unknown;
    };

    if (body.continue_interrupted === true) {
      const jobId =
        (typeof body.job_id === "string" && body.job_id.trim()) ||
        (typeof body.resume_job_id === "string" && body.resume_job_id.trim()) ||
        "";
      if (!jobId) {
        return NextResponse.json({ ok: false, error: "missing job_id" }, { status: 400 });
      }
      const job = await getXhighJob(jobId);
      if (!job || job.phase !== "final_delivery") {
        return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
      }
      if (
        job.failure_reason === "superseded_by_deploy" ||
        ((job.status === "pending" || job.status === "running" || job.status === "failed") &&
          !isDeliveryJobFromCurrentDeploy(job))
      ) {
        // Never re-arm a prior-deploy job — user must Regenerate.
        if (job.status === "pending" || job.status === "running") {
          await failXhighJob(job.job_id, "STOP: superseded by redeploy", {
            retryable: false,
            failure_reason: "superseded_by_deploy",
            current_stage: job.current_stage,
            accumulated_content: "failed:superseded_by_deploy",
          }).catch(() => undefined);
          await forceReleaseDeliveryContinueLease(job.job_id).catch(() => undefined);
        }
        return NextResponse.json(
          {
            ok: false,
            error: "superseded_by_deploy",
            reason: "superseded_by_deploy",
            message: "Prior deploy delivery stopped. Tap Regenerate to start a new report.",
          },
          { status: 409 },
        );
      }
      const { loadDeliveryContinueLease, tryAcquireDeliveryContinueLease } = await import(
        "@/lib/llm/pro/delivery/delivery-stage-store"
      );
      const readyCount = (await loadAllDeliverySegmentReady(job.job_id).catch(() => [])).length;
      const resumable =
        job.status === "failed" &&
        !isProductionV3ClosedFailure(job.failure_reason) &&
        (job.retryable === true ||
          job.failure_reason === "interrupted" ||
          readyCount > 0);
      if (!resumable && job.status !== "pending" && job.status !== "running") {
        return NextResponse.json(
          { ok: false, error: "job_not_resumable", status: job.status, ready_count: readyCount },
          { status: 409 },
        );
      }
      const sessionId = isFinalDeliveryJobInput(job.input)
        ? job.input.session_id
        : job.session_id;
      const stageRaw = job.current_stage ?? "segments";
      const resumeStage =
        stageRaw === "finalize" || stageRaw === "assemble" || stageRaw === "segments"
          ? stageRaw
          : "segments";

      // Already running with a live lease + fresh heartbeat → do not overlap.
      if (job.status === "running" || job.status === "pending") {
        const live = await loadDeliveryContinueLease(job.job_id);
        const heartbeatFresh = Date.now() - job.updated_at <= STALE_RUNNING_MS;
        if (live && heartbeatFresh) {
          return NextResponse.json({
            ok: true,
            job_id: job.job_id,
            status: job.status,
            current_stage: resumeStage,
            resumed: false,
            already_running: true,
          });
        }
        // Dead worker left sticky lease — clear so Continue can re-arm.
        await forceReleaseDeliveryContinueLease(job.job_id).catch(() => undefined);
      } else {
        // Failed/interrupted → sticky lease from killed invoke must not block re-arm.
        await forceReleaseDeliveryContinueLease(job.job_id).catch(() => undefined);
      }

      const acquired = await tryAcquireDeliveryContinueLease(job.job_id, resumeStage);
      if (!acquired.ok) {
        console.warn("[final-delivery] continue_interrupted lease busy — skip re-arm", {
          job_id: job.job_id,
          stage: resumeStage,
          holder_stage: acquired.lease.stage,
          expires_at: acquired.lease.expires_at,
        });
        return NextResponse.json(
          {
            ok: false,
            error: "continue_lease_busy",
            job_id: job.job_id,
            stage: resumeStage,
            ready_count: readyCount,
          },
          { status: 409 },
        );
      }

      await resetDeliverySegmentTransportFailCounts(job.job_id).catch(() => undefined);
      await releaseXhighSessionLock("final_delivery", sessionId).catch(() => undefined);
      const locked = await acquireXhighSessionLock("final_delivery", sessionId);
      if (!locked && job.status !== "running" && job.status !== "pending") {
        await forceReleaseDeliveryContinueLease(job.job_id).catch(() => undefined);
        return NextResponse.json(
          { ok: false, error: "session_lock_busy" },
          { status: 409 },
        );
      }
      await updateXhighJobStatus(job.job_id, "running", {
        current_stage: resumeStage,
        accumulated_content: `user_continue:${resumeStage}`,
      });
      logDeliveryStep({
        job_id: job.job_id,
        level: "hop",
        step: "user Continue",
        detail: `resume ${resumeStage}`,
      });
      {
        const { shouldDispatchContinueViaInngest, publishContinueViaInngest } = await import(
          "@/lib/poju/delivery-continue-dispatch"
        );
        if (shouldDispatchContinueViaInngest()) {
          // Lease already held — release so Inngest hop can re-acquire cleanly.
          await forceReleaseDeliveryContinueLease(job.job_id).catch(() => undefined);
          const published = await publishContinueViaInngest(job.job_id, resumeStage);
          if (published !== "published") {
            after(async () => {
              try {
                const { runFinalDeliveryStage } = await import(
                  "@/lib/poju/final-delivery-stage-runner"
                );
                const again = await tryAcquireDeliveryContinueLease(job.job_id, resumeStage);
                if (!again.ok) return;
                await runFinalDeliveryStage(
                  job.job_id,
                  resumeStage as "finalize" | "segments" | "assemble",
                  { lease_token: again.token },
                );
              } catch (e) {
                console.error("[final-delivery] continue_interrupted after failed:", e);
                await releaseXhighSessionLock("final_delivery", sessionId).catch(() => undefined);
              }
            });
          }
        } else {
          after(async () => {
            try {
              const { runFinalDeliveryStage } = await import(
                "@/lib/poju/final-delivery-stage-runner"
              );
              await runFinalDeliveryStage(
                job.job_id,
                resumeStage as "finalize" | "segments" | "assemble",
                { lease_token: acquired.token },
              );
            } catch (e) {
              console.error("[final-delivery] continue_interrupted after failed:", e);
              await releaseXhighSessionLock("final_delivery", sessionId).catch(() => undefined);
            }
          });
        }
      }
      return NextResponse.json({
        ok: true,
        job_id: job.job_id,
        status: "running",
        current_stage: resumeStage,
        resumed: true,
      });
    }

    if (typeof body.resume_job_id === "string" && body.resume_job_id.trim()) {
      const job = await getXhighJob(body.resume_job_id.trim());
      if (!job || job.phase !== "final_delivery") {
        return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
      }
      return await jobStatusResponse(job);
    }

    const sessionIdRaw =
      typeof body.session_id === "string" && body.session_id.trim() ? body.session_id.trim() : "";
    if (!sessionIdRaw) {
      return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });
    }

    if (body.resume_latest === true) {
      let latest: Awaited<ReturnType<typeof findLatestXhighJobForSession>>;
      try {
        latest = await findLatestXhighJobForSession("final_delivery", sessionIdRaw);
      } catch (e) {
        if (isUpstashPlanLimitError(e)) {
          return NextResponse.json({ ok: true, status: "none", job_id: null });
        }
        throw e;
      }
      if (!latest) {
        // 200 (not 404): empty resume is a normal probe, not a broken route — keeps Vercel logs clean.
        return NextResponse.json({ ok: true, status: "none", job_id: null });
      }
      return await jobStatusResponse(latest);
    }

    if (!isLooseAgentState(body.agent_v2)) {
      return NextResponse.json({ ok: false, error: "Invalid or missing agent_v2" }, { status: 400 });
    }
    const agentV2 = body.agent_v2;

    const delivery_mode = resolveDeliveryMode({
      delivery_mode:
        body.delivery_mode === "degraded" || body.delivery_mode === "full"
          ? body.delivery_mode
          : null,
      agent_v2: body.agent_v2,
    });

    const breakthrough_core =
      body.breakthrough_core === undefined || body.breakthrough_core === null
        ? null
        : isBreakthroughCore(body.breakthrough_core)
          ? body.breakthrough_core
          : null;

    if (delivery_mode === "full" && !breakthrough_core) {
      return NextResponse.json({ ok: false, error: "Missing breakthrough_core" }, { status: 400 });
    }

    const locale = typeof body.locale === "string" ? body.locale : "en";
    const covered_agenda = Array.isArray(body.covered_agenda)
      ? body.covered_agenda
          .filter(
            (e): e is { label: string; answer?: string } =>
              isRecord(e) && typeof e.label === "string",
          )
          .map((e) => ({
            label: e.label,
            answer: typeof e.answer === "string" ? e.answer : undefined,
          }))
      : [];

    const regenerate = body.regenerate === true;
    const skipPass = regenerate;
    const jointPassRef =
      typeof body.joint_pass_ref === "string" && body.joint_pass_ref.startsWith("joint:")
        ? body.joint_pass_ref.trim()
        : null;
    const isJointDecision = body.joint_decision === true || Boolean(jointPassRef);

    const requireDecisionContext = body.require_decision_context === true;
    let decision_context_binding: import("@/lib/poju/decision-context").DecisionContextBinding | null =
      null;
    let decision_context_snapshot: import("@/lib/poju/decision-context").DecisionContext | null =
      null;
    let m22_claim_token: string | null = null;
    let m22_claim_key: string | null = null;
    let m22_report_job_id: string | null = null;
    let m22_reused_completed = false;
    try {
      const { assertSnapshotMatchesBinding } = await import(
        "@/lib/poju/decision-context"
      );
      const {
        loadAuthoritativeFreeze,
        createFrozenReportSnapshot,
      } = await import("@/lib/poju/decision-intake/freeze-bound-report");
      const { loadPOJUSession, savePOJUSession } = await import(
        "@/lib/poju/session-manager"
      );
      const { prepareFreezeBoundFinalDeliveryServer } = await import(
        "@/lib/poju/decision-intake/freeze-bound-report-server"
      );

      const bindingRaw = body.decision_context_binding;
      const snapRaw = body.decision_context_snapshot;
      const clientWantsDc =
        requireDecisionContext ||
        bindingRaw != null ||
        snapRaw != null ||
        body.decision_context != null ||
        (Array.isArray(body.decision_context_versions) &&
          body.decision_context_versions.length > 0);

      // M2.2-R2: server-persisted session is the Freeze authority.
      // Client snapshot/binding may be compared, never replace server Freeze.
      const sessionRow = await loadPOJUSession(sessionIdRaw);
      if (!sessionRow) {
        if (requireDecisionContext || clientWantsDc) {
          return NextResponse.json(
            {
              ok: false,
              error: "Session not found for authoritative Freeze",
              code: "DC_REPORT_MISSING",
            },
            { status: 400 },
          );
        }
      } else if (clientWantsDc || requireDecisionContext) {
        const freezeIdRaw =
          typeof (body as { freeze_id?: unknown }).freeze_id === "string"
            ? String((body as { freeze_id?: string }).freeze_id)
            : undefined;
        const clientBinding =
          bindingRaw && typeof bindingRaw === "object"
            ? (bindingRaw as import("@/lib/poju/decision-context").DecisionContextBinding)
            : null;
        const clientSnap =
          snapRaw && typeof snapRaw === "object"
            ? (snapRaw as import("@/lib/poju/decision-context").DecisionContext)
            : null;

        let loaded;
        try {
          loaded = loadAuthoritativeFreeze(sessionRow, {
            freezeId: freezeIdRaw,
            context_id: clientBinding?.context_id,
            version: clientBinding?.context_version,
            expected_hash: clientBinding?.context_hash,
          });
        } catch (e) {
          const code =
            e && typeof e === "object" && "code" in e
              ? String((e as { code: string }).code)
              : "DC_REPORT_MISSING";
          return NextResponse.json(
            {
              ok: false,
              error: e instanceof Error ? e.message : "Authoritative Freeze load failed",
              code,
            },
            { status: 400 },
          );
        }

        const frozenSnap = createFrozenReportSnapshot({
          sessionId: sessionIdRaw,
          frozen: loaded.frozen,
          binding: loaded.binding,
        });

        // Compare client payload against server authority — never accept client as Freeze.
        if (clientBinding) {
          if (
            clientBinding.context_id !== frozenSnap.binding.context_id ||
            clientBinding.context_version !== frozenSnap.binding.context_version ||
            clientBinding.context_hash !== frozenSnap.binding.context_hash
          ) {
            return NextResponse.json(
              {
                ok: false,
                error: "Client Freeze binding does not match server-authoritative Freeze",
                code: "DC_REPORT_HASH_MISMATCH",
              },
              { status: 400 },
            );
          }
        }
        if (clientSnap) {
          try {
            assertSnapshotMatchesBinding(clientSnap, frozenSnap.binding);
            // Tampered content with matching binding fields still fails hash verify below.
            const { computeContentHash } = await import(
              "@/lib/poju/decision-context/content-hash"
            );
            const clientHash = computeContentHash(clientSnap);
            if (clientHash !== frozenSnap.contentHash) {
              return NextResponse.json(
                {
                  ok: false,
                  error: "Client Freeze snapshot hash does not match server-authoritative Freeze",
                  code: "DC_REPORT_HASH_MISMATCH",
                },
                { status: 400 },
              );
            }
          } catch (e) {
            const code =
              e && typeof e === "object" && "code" in e
                ? String((e as { code: string }).code)
                : "DC_REPORT_HASH_MISMATCH";
            return NextResponse.json(
              {
                ok: false,
                error:
                  e instanceof Error
                    ? e.message
                    : "Client Freeze snapshot rejected against server authority",
                code,
              },
              { status: 400 },
            );
          }
        }

        decision_context_snapshot =
          frozenSnap.decisionContext as import("@/lib/poju/decision-context").DecisionContext;
        decision_context_binding = frozenSnap.binding;

        // Persist Freeze-bound job + acquire shared KV claim BEFORE xhigh create/start.
        // M2.2-R2: on regenerate, drop prior generation claim before acquiring a new one.
        // Comment marker: m22 claim force-release before prepare
        if (regenerate) {
          try {
            const { freezeReportClaimKey, defaultFreezeReportClaimOps } = await import(
              "@/lib/poju/decision-intake/freeze-report-claim"
            );
            const { M22_REPORT_SCHEMA_VERSION } = await import(
              "@/lib/poju/decision-intake/freeze-bound-report"
            );
            const key = freezeReportClaimKey({
              sessionId: sessionIdRaw,
              freezeId: frozenSnap.freezeId,
              reportSchemaVersion: M22_REPORT_SCHEMA_VERSION,
            });
            await defaultFreezeReportClaimOps.forceRelease(key);
          } catch (e) {
            console.warn("[final-delivery] m22 claim force-release before prepare skipped", e);
          }
        }

        const prepared = await prepareFreezeBoundFinalDeliveryServer({
          session: sessionRow,
          freezeId: frozenSnap.freezeId,
          expected_hash: frozenSnap.contentHash,
          acquireGenerationClaim: true,
          deps: {
            persistSession: savePOJUSession,
            loadSession: loadPOJUSession,
          },
        });

        if (!prepared.ok) {
          if (prepared.code === "GENERATION_IN_PROGRESS") {
            // Competing request: reuse in-progress xhigh job; do not start another generator.
            const latest = await findLatestXhighJobForSession(
              "final_delivery",
              sessionIdRaw,
            ).catch(() => null);
            if (latest) {
              return await jobStatusResponse(latest);
            }
            return NextResponse.json(
              {
                ok: false,
                error: prepared.error,
                code: prepared.code,
                retryable: true,
                status: "running",
                job_id: prepared.job?.job_id ?? null,
              },
              { status: 409 },
            );
          }
          if (requireDecisionContext) {
            return NextResponse.json(
              {
                ok: false,
                error: prepared.error,
                code: prepared.code,
              },
              { status: 400 },
            );
          }
        } else {
          decision_context_snapshot = prepared.decision_context_snapshot;
          decision_context_binding = prepared.decision_context_binding;
          m22_report_job_id = prepared.job.job_id;
          m22_reused_completed = prepared.reusedCompleted === true;
          if (prepared.claimHeld && prepared.claimToken && prepared.claimKey) {
            m22_claim_token = prepared.claimToken;
            m22_claim_key = prepared.claimKey;
          }
          if (m22_reused_completed) {
            // Completed Freeze-bound report already exists — still allow formal
            // delivery resume/reuse via existing xhigh job lookup below, but do
            // not acquire a new generator claim.
          }
        }
      }
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e
          ? String((e as { code: string }).code)
          : "DC_REPORT_BIND_FAILED";
      if (requireDecisionContext || body.decision_context_binding != null || body.decision_context != null) {
        return NextResponse.json(
          {
            ok: false,
            error: e instanceof Error ? e.message : "Decision Context bind failed",
            code,
          },
          { status: 400 },
        );
      }
    }

    if (requireDecisionContext && (!decision_context_binding || !decision_context_snapshot)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Stage4 requires frozen Decision Context binding",
          code: "DC_REPORT_MISSING",
        },
        { status: 400 },
      );
    }

    const jobInput: FinalDeliveryJobInput = {
      kind: "final_delivery",
      session_id: sessionIdRaw,
      locale,
      agent_v2: body.agent_v2,
      breakthrough_core,
      covered_agenda,
      base_analysis: body.base_analysis ?? null,
      delivery_mode,
      regenerate,
      dyad_compat_summary:
        body.dyad_compat_summary && typeof body.dyad_compat_summary === "object"
          ? (body.dyad_compat_summary as import("@/lib/poju/dyad-compat").DyadCompatSummary)
          : null,
      partner_bazi:
        body.partner_bazi === "present" || body.partner_bazi === "absent"
          ? body.partner_bazi
          : null,
      pivot_chart_path:
        body.pivot_chart_path === "solo" || body.pivot_chart_path === "dyad"
          ? body.pivot_chart_path
          : null,
      dyad_matrix_pack:
        body.dyad_matrix_pack && typeof body.dyad_matrix_pack === "object"
          ? (body.dyad_matrix_pack as import("@/lib/poju/dyad-matrix-pack").DyadMatrixPack)
          : null,
      joint_decision: isJointDecision,
      joint_pass_ref: jointPassRef,
      decision_context_binding,
      decision_context_snapshot,
      require_decision_context: requireDecisionContext,
      m22_claim_token,
      m22_claim_key,
      m22_report_job_id,
    };

    inlineCall = async () => {
      console.warn("[final-delivery] Upstash plan limit — running book inline without KV", {
        sessionId: sessionIdRaw,
      });
      const done = await runWithEphemeralXhighKv(async () => {
        const created = await createXhighJob({
          phase: "final_delivery",
          session_id: sessionIdRaw,
          locale,
          job_input: jobInput,
          deploy_generation: currentDeliveryDeployGeneration(),
        });
        try {
          await runFinalDeliveryJob(created.job_id);
        } catch (err) {
          const current = await getXhighJob(created.job_id);
          if (current && (current.status === "pending" || current.status === "running")) {
            await failXhighJob(
              created.job_id,
              err instanceof Error ? err.message : String(err),
              { retryable: true, failure_reason: "interrupted" },
            ).catch(() => undefined);
          }
        }
        return getXhighJob(created.job_id);
      }, { deadlineMs: 275_000 });
      if (
        done &&
        done.status === "completed" &&
        isFinalDeliveryJobResult(done.result) &&
        !skipPass
      ) {
        const charged = await chargeDeliveryPass({
          sessionId: sessionIdRaw,
          question: agentV2.original_question,
          jointPassRef,
        });
        if (!charged.ok) return charged.response;
      }
      if (
        done &&
        done.status === "completed" &&
        isFinalDeliveryJobResult(done.result) &&
        done.result.full_text.trim()
      ) {
        return jobStatusResponse(done);
      }
      // A running id only exists in this isolate. Polling /status would 500 on Redis.
      console.warn("[final-delivery] ephemeral book not durable — no pollable job_id", {
        sessionId: sessionIdRaw,
        status: done?.status ?? null,
      });
      return NextResponse.json({
        ok: false,
        status: "failed",
        retryable: true,
        interrupted: false,
        reason: "kv_unavailable",
        error: done?.error || "delivery book was not stored; retry",
      });
    };

    // Resume in-flight job for this session (unless explicit regenerate forces a new one).
    if (!regenerate) {
      let latest: Awaited<ReturnType<typeof findLatestXhighJobForSession>>;
      try {
        latest = await findLatestXhighJobForSession("final_delivery", sessionIdRaw);
      } catch (e) {
        if (isUpstashPlanLimitError(e)) return inlineCall();
        throw e;
      }
      if (latest) {
        // Prior deploy's job — kill without LLM; do not attach client to it.
        if (
          (latest.status === "pending" || latest.status === "running") &&
          !isDeliveryJobFromCurrentDeploy(latest)
        ) {
          console.warn("[final-delivery] supersede prior-deploy job on create probe", {
            job_id: latest.job_id,
            stamped: latest.deploy_generation ?? null,
            current: currentDeliveryDeployGeneration(),
          });
          await failXhighJob(latest.job_id, "STOP: superseded by redeploy", {
            retryable: false,
            failure_reason: "superseded_by_deploy",
            current_stage: latest.current_stage,
            accumulated_content: "failed:superseded_by_deploy",
          }).catch(() => undefined);
          await forceReleaseDeliveryContinueLease(latest.job_id).catch(() => undefined);
          await releaseXhighSessionLock("final_delivery", sessionIdRaw).catch(() => undefined);
          // Fall through — only regenerate should create a new chain after redeploy.
          return NextResponse.json({
            ok: false,
            error: "superseded_by_deploy",
            retryable: false,
            reason: "superseded_by_deploy",
            message: "Prior deploy delivery stopped. Tap Regenerate to start a new report.",
          }, { status: 409 });
        }
        const stale =
          (latest.status === "running" || latest.status === "pending") &&
          Date.now() - latest.updated_at > STALE_RUNNING_MS;
        if (!stale && (latest.status === "pending" || latest.status === "running")) {
          // Do not re-fire work — client keeps polling; status STOPs if truly dead.
          return await jobStatusResponse(latest);
        }
        if (latest.status === "completed" && isFinalDeliveryJobResult(latest.result)) {
          return await jobStatusResponse(latest);
        }
      }
    } else {
      // Regenerate: explicitly STOP any non-terminal job, then create a new chain.
      let latest: Awaited<ReturnType<typeof findLatestXhighJobForSession>> = null;
      try {
        latest = await findLatestXhighJobForSession("final_delivery", sessionIdRaw);
      } catch (e) {
        if (isUpstashPlanLimitError(e)) return inlineCall();
        throw e;
      }
      if (latest && (latest.status === "pending" || latest.status === "running")) {
        await failXhighJob(latest.job_id, "STOP: superseded by regenerate", {
          retryable: false,
          failure_reason: "stale_running",
          current_stage: latest.current_stage,
          accumulated_content: "failed:superseded_by_regenerate",
        }).catch(() => undefined);
        await forceReleaseDeliveryContinueLease(latest.job_id).catch(() => undefined);
        await releaseXhighSessionLock("final_delivery", sessionIdRaw).catch(() => undefined);
      }
    }

        const locked = await acquireXhighSessionLock("final_delivery", sessionIdRaw);
    if (!locked) {
      // Never return an old job as if regenerate succeeded.
      return NextResponse.json(
        { ok: false, error: "delivery_job_busy", retryable: false },
        { status: 409 },
      );
    }

    const job = await createXhighJob({
      phase: "final_delivery",
      session_id: sessionIdRaw,
      locale,
      job_input: jobInput,
      deploy_generation: currentDeliveryDeployGeneration(),
    });

    if (!isFinalDeliveryJobInput(job.input)) {
      if (m22_claim_token && m22_claim_key) {
        const { releaseFreezeBoundReportClaimServer } = await import(
          "@/lib/poju/decision-intake/freeze-bound-report-server"
        );
        await releaseFreezeBoundReportClaimServer({
          claimKey: m22_claim_key,
          claimToken: m22_claim_token,
        }).catch(() => undefined);
      }
      await releaseXhighSessionLock("final_delivery", sessionIdRaw);
      return NextResponse.json({ ok: false, error: "job_create_failed" }, { status: 500 });
    }

    // Bind xhigh job id onto the owned M2.2 claim (token-checked).
    if (m22_claim_token && m22_claim_key) {
      try {
        const { defaultFreezeReportClaimOps } = await import(
          "@/lib/poju/decision-intake/freeze-report-claim"
        );
        await defaultFreezeReportClaimOps.bindJobId(
          m22_claim_key,
          m22_claim_token,
          job.job_id,
        );
      } catch (bindErr) {
        console.warn("[final-delivery] m22 claim bindJobId skipped", bindErr);
      }
    }

    if (!skipPass) {
      const charged = await chargeDeliveryPass({
        sessionId: sessionIdRaw,
        question: agentV2.original_question,
        jointPassRef,
      });
      if (!charged.ok) {
        await failXhighJob(job.job_id, "pass_required", {
          retryable: false,
          failure_reason: "transport_error",
        }).catch(() => undefined);
        if (m22_claim_token && m22_claim_key) {
          const { releaseFreezeBoundReportClaimServer } = await import(
            "@/lib/poju/decision-intake/freeze-bound-report-server"
          );
          await releaseFreezeBoundReportClaimServer({
            claimKey: m22_claim_key,
            claimToken: m22_claim_token,
          }).catch(() => undefined);
        }
        await releaseXhighSessionLock("final_delivery", sessionIdRaw).catch(() => undefined);
        return charged.response;
      }
    }

    await scheduleFinalDeliveryJob(job.job_id, sessionIdRaw);
    logDeliveryStep({
      job_id: job.job_id,
      level: "ok",
      step: "job start",
      detail: regenerate ? "regenerate" : "fresh",
    });
    console.info("[final-delivery] job created", {
      job_id: job.job_id,
      regenerate,
      deploy_generation: job.deploy_generation,
    });

    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
    });
  } catch (e) {
    if (inlineCall && isUpstashPlanLimitError(e)) {
      return inlineCall();
    }
    console.error("[final-delivery]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "final-delivery failed" },
      { status: 500 },
    );
  }
}
