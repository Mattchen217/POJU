/**
 * Durable dispatch outbox — atomic intent+index write; recovery can resend.
 * Intent lifecycle: pending → sent → claimed → completed (or failed).
 * sent ≠ Worker executed — only Task Claim grants execution.
 */

import { createHash, randomUUID } from "node:crypto";

import type { ReportPageId } from "../orchestration/types";
import {
  casSet,
  enqueueIntentAtomic,
  isBatch3SharedStoreAvailable,
  kvGet,
  kvUnavailable,
  listRange,
  trackBatch3Key,
} from "./kv-cas";
import type { Batch3Result, DispatchIntent, DispatchIntentStatus } from "./types";

/** Deterministic intent id — duplicate enqueue is idempotent. */
export function deterministicIntentId(input: {
  generation_id: string;
  page_id: string | null;
  event_name: string;
  task_key?: string | null;
  input_fingerprint?: string | null;
  attempt?: string | null;
}): string {
  const raw = [
    input.generation_id.trim(),
    input.page_id ?? "",
    input.event_name,
    input.task_key ?? "",
    input.input_fingerprint ?? "",
    input.attempt ?? "0",
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function intentKey(
  report_id: string,
  generation_id: string,
  intent_id: string,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:intent:${intent_id}`;
}

function outboxKey(report_id: string, generation_id: string): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:outbox`;
}

/** Secondary index of intent ids for recovery when list is incomplete. */
function intentIndexKey(report_id: string, generation_id: string): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:intent-index`;
}

export async function enqueueDispatchIntent(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  event_name: string;
  page_id?: ReportPageId | null;
  task_key?: string | null;
  attempt_id?: string | null;
  input_fingerprint?: string | null;
  payload: Record<string, unknown>;
}): Promise<Batch3Result<DispatchIntent>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const intent_id = deterministicIntentId({
    generation_id: input.generation_id,
    page_id: input.page_id ?? null,
    event_name: input.event_name,
    task_key: input.task_key,
    input_fingerprint: input.input_fingerprint,
  });
  const iKey = intentKey(input.report_id, input.generation_id, intent_id);
  trackBatch3Key(iKey);
  const existing = await kvGet<DispatchIntent>(iKey);
  if (!existing.ok) return existing;
  if (existing.value) {
    // Idempotent: return existing intent (pending/sent/claimed/completed/failed).
    return { ok: true, value: existing.value };
  }

  const intent: DispatchIntent = {
    intent_id,
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    generation_epoch: input.generation_epoch,
    event_name: input.event_name,
    page_id: input.page_id ?? null,
    task_key: input.task_key ?? null,
    attempt_id: input.attempt_id ?? null,
    input_fingerprint: input.input_fingerprint ?? null,
    payload: input.payload,
    status: "pending",
    created_at: new Date().toISOString(),
    sent_at: null,
    claimed_at: null,
    completed_at: null,
    acked_at: null,
    last_error: null,
  };

  const oKey = outboxKey(input.report_id, input.generation_id);
  const idxKey = intentIndexKey(input.report_id, input.generation_id);
  trackBatch3Key(idxKey);

  const saved = await enqueueIntentAtomic({
    intentKey: iKey,
    outboxKey: oKey,
    intent,
    intent_id,
  });
  if (!saved.ok) return saved;

  const { listPush } = await import("./kv-cas");
  await listPush(idxKey, intent_id);

  return { ok: true, value: intent };
}

export async function markIntentClaimed(
  intent: DispatchIntent,
): Promise<Batch3Result<DispatchIntent>> {
  return setIntentStatus(intent, "claimed", {
    claimed_at: new Date().toISOString(),
  });
}

export async function markIntentCompleted(
  intent: DispatchIntent,
): Promise<Batch3Result<DispatchIntent>> {
  return setIntentStatus(intent, "completed", {
    completed_at: new Date().toISOString(),
  });
}

/** True if page has a live intent that proves dispatch was attempted. */
export async function hasActiveDispatchIntent(input: {
  report_id: string;
  generation_id: string;
  page_id: ReportPageId;
}): Promise<Batch3Result<boolean>> {
  const listed = await listPendingIntents({
    report_id: input.report_id,
    generation_id: input.generation_id,
  });
  if (!listed.ok) return listed;
  const hit = listed.value.some(
    (i) =>
      i.page_id === input.page_id &&
      (i.status === "pending" ||
        i.status === "sent" ||
        i.status === "claimed" ||
        i.status === "completed"),
  );
  // Also scan index for sent intents that left pending list.
  if (hit) return { ok: true, value: true };
  const idx = await listRange<string>(
    intentIndexKey(input.report_id, input.generation_id),
  );
  if (!idx.ok) return idx;
  for (const id of idx.value) {
    const row = await kvGet<DispatchIntent>(
      intentKey(input.report_id, input.generation_id, id),
    );
    if (!row.ok) return row;
    if (
      row.value &&
      row.value.page_id === input.page_id &&
      (row.value.status === "pending" ||
        row.value.status === "sent" ||
        row.value.status === "claimed" ||
        row.value.status === "completed")
    ) {
      return { ok: true, value: true };
    }
  }
  return { ok: true, value: false };
}

async function setIntentStatus(
  intent: DispatchIntent,
  status: DispatchIntentStatus,
  patch?: Partial<DispatchIntent>,
): Promise<Batch3Result<DispatchIntent>> {
  const next: DispatchIntent = {
    ...intent,
    ...patch,
    status,
  };
  const saved = await casSet(
    intentKey(intent.report_id, intent.generation_id, intent.intent_id),
    JSON.stringify(intent),
    next,
  );
  if (!saved.ok) return saved;
  return { ok: true, value: next };
}

export async function markIntentSent(
  intent: DispatchIntent,
): Promise<Batch3Result<DispatchIntent>> {
  // completed/claimed must not regress to sent on duplicate delivery.
  if (intent.status === "completed" || intent.status === "claimed") {
    return { ok: true, value: intent };
  }
  if (intent.status === "sent") {
    return { ok: true, value: intent };
  }
  return setIntentStatus(intent, "sent", {
    sent_at: new Date().toISOString(),
    last_error: null,
  });
}

export async function markIntentAcked(
  intent: DispatchIntent,
): Promise<Batch3Result<DispatchIntent>> {
  return setIntentStatus(intent, "acked", {
    acked_at: new Date().toISOString(),
  });
}

export async function markIntentFailed(
  intent: DispatchIntent,
  error: string,
): Promise<Batch3Result<DispatchIntent>> {
  return setIntentStatus(intent, "failed", { last_error: error });
}

export async function readIntent(
  report_id: string,
  generation_id: string,
  intent_id: string,
): Promise<Batch3Result<DispatchIntent | null>> {
  return kvGet<DispatchIntent>(intentKey(report_id, generation_id, intent_id));
}

export async function listPendingIntents(input: {
  report_id: string;
  generation_id: string;
  limit?: number;
}): Promise<Batch3Result<DispatchIntent[]>> {
  const primary = await listRange<string>(
    outboxKey(input.report_id, input.generation_id),
  );
  if (!primary.ok) return primary;
  const secondary = await listRange<string>(
    intentIndexKey(input.report_id, input.generation_id),
  );
  const ids = [
    ...new Set([
      ...primary.value,
      ...(secondary.ok ? secondary.value : []),
    ]),
  ];
  const limit = input.limit ?? 50;
  const out: DispatchIntent[] = [];
  for (const id of ids.slice(-limit * 2)) {
    const row = await readIntent(input.report_id, input.generation_id, id);
    if (!row.ok) return row;
    if (row.value && (row.value.status === "pending" || row.value.status === "failed")) {
      out.push(row.value);
      if (out.length >= limit) break;
    }
  }
  return { ok: true, value: out };
}
