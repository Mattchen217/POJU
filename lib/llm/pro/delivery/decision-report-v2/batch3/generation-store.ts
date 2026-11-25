/**
 * Generation fencing — monotonic epoch + atomic active switch.
 */

import { randomUUID } from "node:crypto";

import { durableKv, KV_TTL } from "@/lib/kv/client";
import {
  casSet,
  isBatch3SharedStoreAvailable,
  kvGet,
  kvUnavailable,
  trackBatch3Key,
} from "./kv-cas";
import type {
  ActiveGenerationPointer,
  Batch3Result,
  GenerationRecord,
  GenerationStatus,
} from "./types";

function epochKey(report_id: string): string {
  return `report-batch3:${report_id.trim()}:epoch`;
}

function activeKey(report_id: string): string {
  return `report-batch3:${report_id.trim()}:active`;
}

function genKey(report_id: string, generation_id: string): string {
  return `report-batch3:${report_id.trim()}:gen:${generation_id.trim()}`;
}

function batch2PointerKey(job_id: string): string {
  return `report-batch2-active:${job_id.trim()}`;
}

const TERMINAL: ReadonlySet<GenerationStatus> = new Set([
  "completed",
  "failed",
  "superseded",
  "cancelled",
]);

export async function allocateGeneration(input: {
  report_id: string;
  locale: string;
  generation_id?: string;
}): Promise<Batch3Result<GenerationRecord>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const report_id = input.report_id.trim();
  const eKey = epochKey(report_id);
  trackBatch3Key(eKey);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const cur = await kvGet<number>(eKey);
    if (!cur.ok) return cur;
    const nextEpoch = (cur.value ?? 0) + 1;
    const expected = cur.value == null ? null : JSON.stringify(cur.value);
    const bumped = await casSet(eKey, expected, nextEpoch);
    if (!bumped.ok) {
      if (bumped.code === "conflict") continue;
      return bumped;
    }

    const now = new Date().toISOString();
    const generation_id = (input.generation_id?.trim() || randomUUID()).trim();
    const record: GenerationRecord = {
      report_id,
      generation_id,
      generation_epoch: nextEpoch,
      status: "active",
      locale: input.locale.trim() || "en",
      created_at: now,
      updated_at: now,
      superseded_at: null,
      superseded_by: null,
    };
    const gKey = genKey(report_id, generation_id);
    const written = await casSet(gKey, null, record);
    if (!written.ok) return written;
    return { ok: true, value: record };
  }
  return { ok: false, code: "conflict", detail: "allocateGeneration epoch CAS exhausted" };
}

/**
 * Atomically activate a generation as the report's sole active generation.
 * Marks previous active as superseded. Updates Batch2 active pointer.
 */
export async function activateGeneration(input: {
  record: GenerationRecord;
  /** Final-delivery job_id (usually equals report_id). */
  job_id?: string;
}): Promise<Batch3Result<ActiveGenerationPointer>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const { record } = input;
  const report_id = record.report_id.trim();
  const aKey = activeKey(report_id);
  trackBatch3Key(aKey);

  const live = await kvGet<ActiveGenerationPointer>(aKey);
  if (!live.ok) return live;

  if (
    live.value &&
    live.value.generation_id === record.generation_id &&
    live.value.generation_epoch === record.generation_epoch
  ) {
    return { ok: true, value: live.value };
  }

  if (live.value) {
    const prevKey = genKey(report_id, live.value.generation_id);
    const prev = await kvGet<GenerationRecord>(prevKey);
    if (!prev.ok) return prev;
    if (prev.value && !TERMINAL.has(prev.value.status)) {
      const superseded: GenerationRecord = {
        ...prev.value,
        status: "superseded",
        updated_at: new Date().toISOString(),
        superseded_at: new Date().toISOString(),
        superseded_by: record.generation_id,
      };
      const marked = await casSet(
        prevKey,
        JSON.stringify(prev.value),
        superseded,
      );
      if (!marked.ok && marked.code !== "conflict") return marked;
    }
  }

  const pointer: ActiveGenerationPointer = {
    report_id,
    generation_id: record.generation_id,
    generation_epoch: record.generation_epoch,
    switched_at: new Date().toISOString(),
  };
  const expected = live.value == null ? null : JSON.stringify(live.value);
  const switched = await casSet(aKey, expected, pointer);
  if (!switched.ok) return switched;

  // Ensure gen record is active
  const gKey = genKey(report_id, record.generation_id);
  const curGen = await kvGet<GenerationRecord>(gKey);
  if (!curGen.ok) return curGen;
  if (curGen.value) {
    if (TERMINAL.has(curGen.value.status) && curGen.value.status !== "active") {
      // allow activating a freshly allocated record only
      if (curGen.value.status !== "superseded") {
        /* keep */
      }
    }
    const activeRec: GenerationRecord = {
      ...curGen.value,
      status: "active",
      updated_at: new Date().toISOString(),
    };
    await casSet(gKey, JSON.stringify(curGen.value), activeRec);
  }

  // Batch2 production pointer (tri-state readers)
  const job_id = (input.job_id ?? report_id).trim();
  const b2Key = batch2PointerKey(job_id);
  trackBatch3Key(b2Key);
  try {
    await durableKv().set(
      b2Key,
      {
        report_id,
        generation_id: record.generation_id,
        started_at: pointer.switched_at,
        generation_epoch: record.generation_epoch,
      },
      { ex: KV_TTL.REPORT_BATCH2_JOB },
    );
  } catch (err) {
    return {
      ok: false,
      code: "pointer_write_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  return { ok: true, value: pointer };
}

export async function readActiveGeneration(
  report_id: string,
): Promise<Batch3Result<ActiveGenerationPointer | null>> {
  return kvGet<ActiveGenerationPointer>(activeKey(report_id.trim()));
}

export async function readGeneration(
  report_id: string,
  generation_id: string,
): Promise<Batch3Result<GenerationRecord | null>> {
  return kvGet<GenerationRecord>(genKey(report_id.trim(), generation_id.trim()));
}

export async function assertGenerationActive(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
}): Promise<Batch3Result<GenerationRecord>> {
  const active = await readActiveGeneration(input.report_id);
  if (!active.ok) return active;
  if (!active.value) {
    return {
      ok: false,
      code: "stale_generation",
      detail: "no active generation pointer",
    };
  }
  if (
    active.value.generation_id !== input.generation_id.trim() ||
    active.value.generation_epoch !== input.generation_epoch
  ) {
    return {
      ok: false,
      code: "stale_generation",
      detail: `active=${active.value.generation_id}@${active.value.generation_epoch} request=${input.generation_id}@${input.generation_epoch}`,
    };
  }
  const gen = await readGeneration(input.report_id, input.generation_id);
  if (!gen.ok) return gen;
  if (!gen.value) {
    return { ok: false, code: "not_found", detail: "generation record missing" };
  }
  if (gen.value.status !== "active") {
    return {
      ok: false,
      code: "stale_generation",
      detail: `generation status=${gen.value.status}`,
    };
  }
  if (gen.value.generation_epoch !== input.generation_epoch) {
    return {
      ok: false,
      code: "stale_generation",
      detail: "generation_epoch mismatch on record",
    };
  }
  return { ok: true, value: gen.value };
}

export async function transitionGenerationStatus(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  to: GenerationStatus;
}): Promise<Batch3Result<GenerationRecord>> {
  const gen = await readGeneration(input.report_id, input.generation_id);
  if (!gen.ok) return gen;
  if (!gen.value) {
    return { ok: false, code: "not_found", detail: "generation missing" };
  }
  if (gen.value.generation_epoch !== input.generation_epoch) {
    return { ok: false, code: "stale_generation", detail: "epoch mismatch" };
  }
  if (TERMINAL.has(gen.value.status) && input.to === "active") {
    return {
      ok: false,
      code: "generation_terminal",
      detail: `cannot reactivate ${gen.value.status} via ordinary transition`,
    };
  }
  const next: GenerationRecord = {
    ...gen.value,
    status: input.to,
    updated_at: new Date().toISOString(),
  };
  const saved = await casSet(
    genKey(input.report_id, input.generation_id),
    JSON.stringify(gen.value),
    next,
  );
  if (!saved.ok) return saved;
  return { ok: true, value: next };
}
