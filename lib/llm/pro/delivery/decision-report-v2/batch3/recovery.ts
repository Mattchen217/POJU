/**
 * Recovery — rehydrate from KV; never runs LLM; capped work per invocation.
 */

import { randomUUID } from "node:crypto";

import {
  buildGeneratePayload,
  buildOrchestratePayload,
  buildRepairPayload,
  sendReportBatch2Events,
} from "../batch2/dispatch";
import { REPORT_BATCH2_EVENTS } from "../batch2/events";
import { loadJob, loadJobRawBlobs } from "../batch2/job-store";
import { runReportBatch2OrchestratorTick } from "../batch2/orchestrator";
import { REPORT_PAGE_IDS, resolveReportReadyState } from "../orchestration";
import type { ReportPageId } from "../orchestration/types";
import { readAuthorityPageOutput } from "./auth-output";
import {
  enqueueDispatchIntent,
  listPendingIntents,
  markIntentFailed,
  markIntentSent,
  readIntent,
} from "./dispatch-intent";
import { assertGenerationActive, readGeneration } from "./generation-store";
import { readPageFence } from "./page-fence";
import { persistPageBlobUnderCommittedFence } from "./persist-page-blob";
import type { Batch3Result } from "./types";
import { DEFAULT_RECOVERY_LIMIT } from "./types";

export type RecoveryAction = {
  kind:
    | "orchestrate"
    | "resend_intent"
    | "dispatch_ready"
    | "dispatch_repair"
    | "replay_page_blob"
    | "skipped_superseded"
    | "skipped_completed"
    | "job_missing";
  detail: string;
  page_id?: ReportPageId | null;
};

export async function runReportBatch3Recovery(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  locale?: string;
  limit?: number;
}): Promise<
  Batch3Result<{ recovery_id: string; actions: RecoveryAction[]; stopped_reason?: string }>
> {
  const recovery_id = randomUUID();
  const limit = input.limit ?? DEFAULT_RECOVERY_LIMIT;
  const actions: RecoveryAction[] = [];

  const fence = await assertGenerationActive({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
  });
  if (!fence.ok) {
    if (fence.code === "stale_generation") {
      return {
        ok: true,
        value: {
          recovery_id,
          actions: [
            {
              kind: "skipped_superseded",
              detail: fence.detail,
            },
          ],
        },
      };
    }
    return fence;
  }

  const gen = await readGeneration(input.report_id, input.generation_id);
  if (!gen.ok) return gen;
  if (!gen.value || gen.value.status !== "active") {
    return {
      ok: true,
      value: {
        recovery_id,
        actions: [
          {
            kind: "skipped_superseded",
            detail: `generation status=${gen.value?.status ?? "missing"}`,
          },
        ],
      },
    };
  }

  const loaded = await loadJob(input.report_id, input.generation_id);
  if (!loaded.ok) {
    return {
      ok: false,
      code: loaded.code === "kv_unavailable" ? "kv_unavailable" : "kv_read_failed",
      detail: loaded.detail,
    };
  }
  if (!loaded.value) {
    // Generation active but Job never persisted — fail closed; do not pretend
    // ORCHESTRATE succeeded. Caller must re-run job bootstrap.
    return {
      ok: false,
      code: "job_missing",
      detail:
        "active generation has no Job record — refuse orchestrate; bootstrap job then retry recovery",
      // Batch3Result doesn't allow extra fields on fail — keep detail only
    };
  }

  const job = loaded.value;
  const locale = input.locale ?? job.locale;

  // 0a) Continue incomplete CascadeOperation (frozen targets — never replan).
  {
    const { readActiveCascadeOperation } = await import("./cascade-operation");
    const { continueCascadeOperation } = await import("./invalidation");
    const { reopenStaleFenceIfReady } = await import("./page-fence");
    const activeCascade = await readActiveCascadeOperation(
      input.report_id,
      input.generation_id,
    );
    if (!activeCascade.ok) return activeCascade;
    if (
      activeCascade.value &&
      (activeCascade.value.status === "running" ||
        activeCascade.value.status === "failed_recoverable")
    ) {
      if (actions.length >= limit) {
        return {
          ok: true,
          value: { recovery_id, actions, stopped_reason: "limit_reached" },
        };
      }
      const cont = await continueCascadeOperation({
        report_id: input.report_id,
        generation_id: input.generation_id,
        operation_id: activeCascade.value.operation_id,
      });
      actions.push({
        kind: cont.ok ? "dispatch_ready" : "skipped_superseded",
        detail: cont.ok
          ? `cascade ${activeCascade.value.operation_id} → ${cont.value.cascade_status}`
          : `cascade continue failed: ${cont.detail}`,
      });
    }

    // Reopen stale fences when deps ready (before dispatch).
    for (const page_id of REPORT_PAGE_IDS) {
      if (actions.length >= limit) break;
      const reopened = await reopenStaleFenceIfReady({
        report_id: input.report_id,
        generation_id: input.generation_id,
        generation_epoch: input.generation_epoch,
        page_id,
      });
      if (reopened.ok && reopened.value.status === "open") {
        actions.push({
          kind: "dispatch_ready",
          detail: `reopened stale fence ${page_id} rev=${reopened.value.validity_rev}`,
          page_id,
        });
      }
    }
  }

  // Raw blobs (pre-authority demotion) — detect physical missing/mismatched persist.
  const rawBlobs = await loadJobRawBlobs(input.report_id, input.generation_id);
  if (!rawBlobs.ok) {
    return {
      ok: false,
      code: rawBlobs.code === "kv_unavailable" ? "kv_unavailable" : "kv_read_failed",
      detail: rawBlobs.detail,
    };
  }

  // 0) Replay authority-committed pages whose Batch2 blob is missing / mismatched
  for (const page_id of REPORT_PAGE_IDS) {
    if (actions.length >= limit) {
      return {
        ok: true,
        value: { recovery_id, actions, stopped_reason: "limit_reached" },
      };
    }
    const fence = await readPageFence(
      input.report_id,
      input.generation_id,
      page_id,
    );
    if (!fence.ok) return fence;
    if (!fence.value || fence.value.status !== "committed") continue;
    if (fence.value.generation_epoch !== input.generation_epoch) continue;

    const auth = await readAuthorityPageOutput(
      input.report_id,
      input.generation_id,
      page_id,
    );
    if (!auth.ok) return auth;
    if (!auth.value) continue;
    if (auth.value.validity_rev !== fence.value.validity_rev) continue;
    if (auth.value.output_fingerprint !== fence.value.output_fingerprint) continue;

    const rawBlob = rawBlobs.value?.pages.get(page_id);
    const blobOk =
      !!rawBlob &&
      rawBlob.state.outcome === "completed" &&
      rawBlob.state.output_fingerprint === fence.value.output_fingerprint &&
      rawBlob.authority_output_fingerprint === fence.value.output_fingerprint &&
      (rawBlob.validity_rev ?? -1) === fence.value.validity_rev &&
      rawBlob.output != null;
    if (blobOk) {
      actions.push({
        kind: "skipped_completed",
        detail: `page ${page_id} blob already matches authority`,
        page_id,
      });
      continue;
    }

    const state = {
      page_id,
      outcome: (auth.value.state_patch.outcome ?? "completed") as
        | "completed"
        | "pending",
      output_fingerprint: auth.value.output_fingerprint,
      input_fingerprint: auth.value.state_patch.input_fingerprint,
      ...auth.value.state_patch,
    };
    const replayed = await persistPageBlobUnderCommittedFence({
      report_id: input.report_id,
      generation_id: input.generation_id,
      page_id,
      validity_rev: fence.value.validity_rev,
      attempt_id: fence.value.attempt_id ?? auth.value.attempt_id,
      output_fingerprint: auth.value.output_fingerprint,
      state,
      output: auth.value.output,
    });
    if (!replayed.ok) {
      if (replayed.code === "stale_page") {
        actions.push({
          kind: "skipped_superseded",
          detail: `replay refused for ${page_id}: ${replayed.detail}`,
          page_id,
        });
        continue;
      }
      return replayed;
    }
    actions.push({
      kind: "replay_page_blob",
      detail: `restored page ${page_id} from authority output`,
      page_id,
    });
  }

  // 1) Pending / failed intents
  const pending = await listPendingIntents({
    report_id: input.report_id,
    generation_id: input.generation_id,
    limit,
  });
  if (!pending.ok) return pending;
  for (const intent of pending.value) {
    if (actions.length >= limit) {
      return {
        ok: true,
        value: { recovery_id, actions, stopped_reason: "limit_reached" },
      };
    }
    if (intent.generation_epoch !== input.generation_epoch) {
      actions.push({
        kind: "skipped_superseded",
        detail: `intent ${intent.intent_id} epoch mismatch`,
      });
      continue;
    }
    const send = await sendReportBatch2Events([
      {
        name: intent.event_name as typeof REPORT_BATCH2_EVENTS.ORCHESTRATE,
        data: intent.payload as never,
      },
    ]);
    if (!send.ok) {
      const marked = await markIntentFailed(intent, send.detail);
      if (!marked.ok) return marked;
      return {
        ok: false,
        code: "dispatch_failed",
        detail: `dispatch_failed:${send.code}:${send.detail}`,
      };
    }
    const markedSent = await markIntentSent(intent);
    if (!markedSent.ok) return markedSent;
    actions.push({
      kind: "resend_intent",
      detail: intent.intent_id,
      page_id: intent.page_id,
    });
  }

  // 2) Repair pending without progress
  for (const page_id of Object.keys(job.repair_pending) as ReportPageId[]) {
    if (actions.length >= limit) break;
    const pendingRepair = job.repair_pending[page_id];
    if (!pendingRepair) continue;
    const st = job.page_states.find((s) => s.page_id === page_id);
    if (st?.outcome === "completed") {
      actions.push({
        kind: "skipped_completed",
        detail: `repair skipped; page ${page_id} completed`,
        page_id,
      });
      continue;
    }
    const payload = buildRepairPayload({
      report_id: input.report_id,
      generation_id: input.generation_id,
      page_id,
      locale,
      input_fingerprint: pendingRepair.input_fingerprint,
      generation_epoch: input.generation_epoch,
    });
    const intent = await enqueueDispatchIntent({
      report_id: input.report_id,
      generation_id: input.generation_id,
      generation_epoch: input.generation_epoch,
      event_name: REPORT_BATCH2_EVENTS.REPAIR,
      page_id,
      input_fingerprint: pendingRepair.input_fingerprint,
      payload: {
        ...payload.data,
        generation_epoch: input.generation_epoch,
      },
    });
    if (!intent.ok) return intent;
    const send = await sendReportBatch2Events([payload]);
    if (!send.ok) {
      const marked = await markIntentFailed(intent.value, send.detail);
      if (!marked.ok) return marked;
      return {
        ok: false,
        code: "dispatch_failed",
        detail: `dispatch_failed:${send.code}:${send.detail}`,
      };
    }
    const markedSent = await markIntentSent(intent.value);
    if (!markedSent.ok) return markedSent;
    actions.push({ kind: "dispatch_repair", detail: "repair_pending", page_id });
  }

  // 2b) Orphan queued pages (queued on Job but no Intent) — heal via orchestrator
  {
    const { hasActiveDispatchIntent } = await import("./dispatch-intent");
    let orphanQueued = false;
    for (const st of job.page_states) {
      if (st.outcome !== "queued") continue;
      const has = await hasActiveDispatchIntent({
        report_id: input.report_id,
        generation_id: input.generation_id,
        page_id: st.page_id,
      });
      if (!has.ok) return has;
      if (!has.value) {
        orphanQueued = true;
        // Reset to pending so orchestrator can re-dispatch with Intent-first.
        const { updatePageState } = await import("../batch2/job-store");
        updatePageState(job, st.page_id, { outcome: "pending" });
        actions.push({
          kind: "dispatch_ready",
          detail: `orphan queued healed → pending for ${st.page_id}`,
          page_id: st.page_id,
        });
      }
    }
    if (orphanQueued) {
      const { saveJob } = await import("../batch2/job-store");
      const saved = await saveJob(job);
      if (!saved.ok) {
        return {
          ok: false,
          code: saved.code === "kv_unavailable" ? "kv_unavailable" : "kv_write_failed",
          detail: saved.detail,
        };
      }
    }
  }

  // 2c) Delivery resume — sealed / delivering / delivery_failed resume same seal only
  {
    const { readFinalizationClaim } = await import("./finalization");
    const claim = await readFinalizationClaim(
      input.report_id,
      input.generation_id,
    );
    if (!claim.ok) return claim;
    if (
      claim.value &&
      (claim.value.status === "sealed" ||
        claim.value.status === "claimed" ||
        claim.value.status === "delivering" ||
        claim.value.status === "delivery_failed")
    ) {
      actions.push({
        kind: "dispatch_ready",
        detail: `finalization delivery resume candidate status=${claim.value.status} claim_id=${claim.value.claim_id}`,
      });
    }
  }

  // 3) Ready pages not yet completed — re-run orchestrator tick (idempotent dispatch)
  const ready = resolveReportReadyState(job.page_states);
  if (
    ready.ready_model_generations.length > 0 ||
    ready.ready_applicability_gates.length > 0
  ) {
    if (actions.length < limit) {
      const tick = await runReportBatch2OrchestratorTick({
        report_id: input.report_id,
        generation_id: input.generation_id,
      });
      if (!tick.ok) {
        return {
          ok: false,
          code: "kv_write_failed",
          detail: tick.detail,
        };
      }
      actions.push({
        kind: "dispatch_ready",
        detail: `dispatched=${tick.dispatched.length}`,
      });
    }
  } else if (job.status === "pending" || job.status === "orchestrating") {
    if (actions.length < limit && job.dispatch_log.length === 0) {
      const payload = buildOrchestratePayload({
        report_id: input.report_id,
        generation_id: input.generation_id,
        locale,
        generation_epoch: input.generation_epoch,
      });
      const intent = await enqueueDispatchIntent({
        report_id: input.report_id,
        generation_id: input.generation_id,
        generation_epoch: input.generation_epoch,
        event_name: REPORT_BATCH2_EVENTS.ORCHESTRATE,
        payload: { ...payload.data, generation_epoch: input.generation_epoch },
      });
      if (!intent.ok) return intent;
      const send = await sendReportBatch2Events([payload]);
      if (!send.ok) {
        await markIntentFailed(intent.value, send.detail);
      } else {
        await markIntentSent(intent.value);
        actions.push({ kind: "orchestrate", detail: "empty_dispatch_log" });
      }
    }
  }

  void buildGeneratePayload;
  void readIntent;

  return {
    ok: true,
    value: {
      recovery_id,
      actions,
      stopped_reason: actions.length >= limit ? "limit_reached" : undefined,
    },
  };
}
