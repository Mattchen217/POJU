/**
 * M3 — server-side KV for the Decision Intake 2.0 report chain.
 *
 * The session itself lives only on the device (Never Stored), so the server keeps
 * short-lived (xhigh job TTL) write-once registries:
 *  - Freeze registry: frozen DC + Blueprint per (session, freeze_id). First write
 *    wins; a different content_hash for the same Freeze is refused. Every stage
 *    re-reads and re-verifies it — request bodies are never trusted after create.
 *  - Profile registry: structured base analysis + Ziwei soft labels per profile hash
 *    (no raw birth data).
 *  - Personal Analysis records keyed by the idempotency key.
 *  - Page records keyed by job_id (an execution generation never writes another's pages).
 */

import { sha256 } from "@noble/hashes/sha2.js";

import { kv, KV_TTL } from "@/lib/kv/client";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_IDS } from "@/lib/llm/pro/delivery/page-feed-matrix";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { assertFrozenDcIntegrity, bindingFromDecisionContext } from "@/lib/poju/decision-context/read-bound";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type {
  DecisionReportPageRecord,
  PersonalAnalysisRecord,
} from "./decision-report-types";
import type { Di2PageStructured } from "./decision-report-render";
import { deepFreezeValue, freezeIdFromBinding } from "./freeze-bound-report";
import {
  computeProfileHash,
  type ProfileProjection,
  type RegisteredProfile,
} from "./personal-analysis";
import type { DecisionBlueprint } from "./types";

const TTL = KV_TTL.POJU_XHIGH_JOB;
const textEncoder = new TextEncoder();

function shortHash(s: string): string {
  let out = "";
  for (const b of sha256(textEncoder.encode(s)).slice(0, 16)) out += b.toString(16).padStart(2, "0");
  return out;
}

function safe(s: string): string {
  return s.replace(/[^a-zA-Z0-9@_.:-]/g, "_");
}

export class DecisionReportStoreError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DecisionReportStoreError";
    this.code = code;
  }
}

// ─── Freeze registry ───────────────────────────────────────────────────────

export type RegisteredFreeze = {
  session_id: string;
  freeze_id: string;
  context_hash: string;
  decision_context: DecisionContext;
  blueprint: DecisionBlueprint | null;
  registered_at: string;
};

export function di2FreezeKey(session_id: string, freeze_id: string): string {
  return `poju-di2:freeze:${safe(session_id)}:${safe(freeze_id)}`;
}

export async function registerFrozenDecisionContext(input: {
  session_id: string;
  decision_context: DecisionContext;
  blueprint: DecisionBlueprint | null;
  now?: string;
}): Promise<RegisteredFreeze> {
  const dc = input.decision_context;
  if (dc.status !== "final") {
    throw new DecisionReportStoreError(
      "FREEZE_NOT_FINAL",
      `Only the current final Freeze can start a report (status=${dc.status})`,
    );
  }
  try {
    assertFrozenDcIntegrity(dc);
  } catch (e) {
    throw new DecisionReportStoreError(
      "FREEZE_INTEGRITY",
      e instanceof Error ? e.message : String(e),
    );
  }
  const binding = bindingFromDecisionContext(dc);
  const freeze_id = freezeIdFromBinding(binding);
  let blueprint = input.blueprint ?? null;
  if (blueprint) {
    if (blueprint.context_id !== dc.context_id || blueprint.session_id !== input.session_id) {
      throw new DecisionReportStoreError(
        "BLUEPRINT_MISMATCH",
        "Blueprint does not belong to this session / Decision Context",
      );
    }
    blueprint = JSON.parse(JSON.stringify(blueprint)) as DecisionBlueprint;
  }
  const entry: RegisteredFreeze = {
    session_id: input.session_id,
    freeze_id,
    context_hash: binding.context_hash,
    decision_context: JSON.parse(JSON.stringify(dc)) as DecisionContext,
    blueprint,
    registered_at: input.now ?? new Date().toISOString(),
  };
  const key = di2FreezeKey(input.session_id, freeze_id);
  const claimed = await kv.set(key, entry, { ex: TTL, nx: true });
  if (claimed === "OK") return entry;
  const existing = await kv.get<RegisteredFreeze>(key);
  if (!existing) {
    // Expired between NX and GET — write once more under NX.
    const again = await kv.set(key, entry, { ex: TTL, nx: true });
    if (again === "OK") return entry;
    throw new DecisionReportStoreError("FREEZE_REGISTRY_RACE", "Freeze registry write race");
  }
  if (existing.context_hash !== entry.context_hash) {
    throw new DecisionReportStoreError(
      "FREEZE_CONFLICT",
      `Freeze ${freeze_id} already registered with a different content_hash`,
    );
  }
  return existing;
}

/** Re-verify on every read: integrity + exact binding the job was created for. */
export async function loadRegisteredFreeze(input: {
  session_id: string;
  freeze_id: string;
  context_hash: string;
}): Promise<RegisteredFreeze> {
  const entry = await kv.get<RegisteredFreeze>(di2FreezeKey(input.session_id, input.freeze_id));
  if (!entry) {
    throw new DecisionReportStoreError(
      "FREEZE_NOT_REGISTERED",
      `Freeze ${input.freeze_id} is not registered (expired or never started)`,
    );
  }
  if (entry.context_hash !== input.context_hash) {
    throw new DecisionReportStoreError("FREEZE_CONFLICT", "Registered Freeze hash differs from job binding");
  }
  try {
    assertFrozenDcIntegrity(entry.decision_context);
  } catch (e) {
    throw new DecisionReportStoreError(
      "FREEZE_INTEGRITY",
      e instanceof Error ? e.message : String(e),
    );
  }
  const binding = bindingFromDecisionContext(entry.decision_context);
  if (freezeIdFromBinding(binding) !== input.freeze_id) {
    throw new DecisionReportStoreError("FREEZE_CONFLICT", "Registered Freeze identity mismatch");
  }
  return deepFreezeValue(entry);
}

// ─── Profile registry ──────────────────────────────────────────────────────

export function di2ProfileKey(session_id: string, profile_hash: string): string {
  return `poju-di2:profile:${safe(session_id)}:${profile_hash}`;
}

export async function registerProfile(input: {
  session_id: string;
  profile_id: string | null;
  structured: ProfileStructured;
  ziwei_closed_set: string | null;
  now?: string;
}): Promise<RegisteredProfile> {
  const profile_hash = computeProfileHash({
    structured: input.structured,
    ziwei_closed_set: input.ziwei_closed_set,
  });
  const entry: RegisteredProfile = {
    profile_id: input.profile_id,
    profile_hash,
    structured: JSON.parse(JSON.stringify(input.structured)) as ProfileStructured,
    ziwei_closed_set: input.ziwei_closed_set,
    registered_at: input.now ?? new Date().toISOString(),
  };
  const key = di2ProfileKey(input.session_id, profile_hash);
  const claimed = await kv.set(key, entry, { ex: TTL, nx: true });
  if (claimed === "OK") return entry;
  const existing = await kv.get<RegisteredProfile>(key);
  if (existing) {
    // Refresh TTL for the in-use profile; content is identical by hash.
    await kv.set(key, existing, { ex: TTL });
    return existing;
  }
  await kv.set(key, entry, { ex: TTL });
  return entry;
}

export async function loadRegisteredProfile(input: {
  session_id: string;
  profile_hash: string;
}): Promise<RegisteredProfile> {
  const entry = await kv.get<RegisteredProfile>(di2ProfileKey(input.session_id, input.profile_hash));
  if (!entry) {
    throw new DecisionReportStoreError(
      "PROFILE_NOT_REGISTERED",
      "Personal profile snapshot expired or was never registered",
    );
  }
  const recomputed = computeProfileHash({
    structured: entry.structured,
    ziwei_closed_set: entry.ziwei_closed_set,
  });
  if (recomputed !== input.profile_hash) {
    throw new DecisionReportStoreError("PROFILE_HASH_MISMATCH", "Profile snapshot hash mismatch");
  }
  return entry;
}

// ─── Personal Analysis records ─────────────────────────────────────────────

export type StoredAnalysis = {
  record: PersonalAnalysisRecord;
  /** Chart lines the analysis was computed against (pages reuse the same lines). */
  projection: ProfileProjection | null;
};

export function di2AnalysisKey(idempotency_key: string): string {
  return `poju-di2:analysis:${shortHash(idempotency_key)}`;
}

export async function loadAnalysis(idempotency_key: string): Promise<StoredAnalysis | null> {
  const got = await kv.get<StoredAnalysis>(di2AnalysisKey(idempotency_key));
  if (!got || got.record.idempotency_key !== idempotency_key) return null;
  return got;
}

/**
 * Write an analysis record. A completed record is final for its key: later writes
 * (stale workers, failure stamps) never overwrite it.
 */
export async function saveAnalysis(next: StoredAnalysis): Promise<StoredAnalysis> {
  const key = di2AnalysisKey(next.record.idempotency_key);
  const cur = await kv.get<StoredAnalysis>(key);
  if (cur && cur.record.idempotency_key === next.record.idempotency_key && cur.record.status === "completed") {
    return cur;
  }
  await kv.set(key, next, { ex: TTL });
  return next;
}

// ─── Page records ──────────────────────────────────────────────────────────

export type StoredPage = {
  record: DecisionReportPageRecord;
  structured: Di2PageStructured | null;
};

export function di2PageKey(job_id: string, page_id: DecisionPageId): string {
  return `poju-di2:page:${safe(job_id)}:${page_id}`;
}

export async function loadPage(job_id: string, page_id: DecisionPageId): Promise<StoredPage | null> {
  const got = await kv.get<StoredPage>(di2PageKey(job_id, page_id));
  if (!got || got.record.job_id !== job_id || got.record.page_id !== page_id) return null;
  return got;
}

/** Completed pages are checkpoints: a retry of another page never touches them. */
export async function savePage(next: StoredPage): Promise<StoredPage> {
  const key = di2PageKey(next.record.job_id, next.record.page_id);
  const cur = await kv.get<StoredPage>(key);
  if (cur && cur.record.status === "completed" && cur.record.job_id === next.record.job_id) {
    return cur;
  }
  await kv.set(key, next, { ex: TTL });
  return next;
}

export async function loadAllPages(job_id: string): Promise<StoredPage[]> {
  const out: StoredPage[] = [];
  for (const id of DECISION_PAGE_IDS) {
    const p = await loadPage(job_id, id);
    if (p) out.push(p);
  }
  return out;
}
