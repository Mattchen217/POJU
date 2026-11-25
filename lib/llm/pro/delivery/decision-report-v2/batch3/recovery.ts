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
import { loadJob } from "../batch2/job-store";
import { runReportBatch2OrchestratorTick } from "../batch2/orchestrator";
import { resolveReportReadyState } from "../orchestration";
import type { ReportPageId } from "../orchestration/types";
import {
  enqueueDispatchIntent,
  listPendingIntents,
  markIntentFailed,
  markIntentSent,
  readIntent,
} from "./dispatch-intent";
import { assertGenerationActive, readGeneration } from "./generation-store";
import type { Batch3Result } from "./types";
import { DEFAULT_RECOVERY_LIMIT } from "./types";

export type RecoveryAction = {
  kind:
    | "orchestrate"
    | "resend_intent"
    | "dispatch_ready"
    | "dispatch_repair"
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
      await markIntentFailed(intent, send.detail);
      return {
        ok: false,
        code: "kv_write_failed",
        detail: send.detail,
      };
    }
    await markIntentSent(intent);
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
      await markIntentFailed(intent.value, send.detail);
      continue;
    }
    await markIntentSent(intent.value);
    actions.push({ kind: "dispatch_repair", detail: "repair_pending", page_id });
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
