/**
 * M4 — server DC commit ledger (append-only, write-once slots in the durable KV).
 *
 * Keys (all under the authority retention window, refreshed on every write):
 *  - entry  `poju-auth:ledger:{sid}:e:{n}`   one immutable commit per slot (NX)
 *  - idem   `poju-auth:ledger:{sid}:k:{h}`   idempotency_key → commit_version (NX)
 *  - head   `poju-auth:ledger:{sid}:head`    hint only; the true head is probed forward
 *  - meta   `poju-auth:ledger:{sid}:meta`    genesis entry hash (writer-token root)
 *
 * Concurrency: the NX on slot n+1 is the single serialization point. Two writers that
 * read the same head race for the same slot; exactly one wins, the loser is answered as
 * a duplicate (same key + same content) or CONCURRENT_COMMIT.
 */

import { durableKv, KV_TTL } from "@/lib/kv/client";
import { computeContentHash } from "@/lib/poju/decision-context/content-hash";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { DecisionBlueprint } from "@/lib/poju/decision-intake/types";
import type { ConfirmationEvent } from "@/lib/poju/decision-context/confirmation-event";
import { blueprintHash, canonicalHash, dcSnapshotHash, normalizeJson, sha256Hex } from "../hash";
import { DcLedgerRuleError, validateLedgerTransition } from "../ledger-rules";
import {
  DC_LEDGER_SCHEMA_VERSION,
  headRefFromEntry,
  type DcLedgerAppendRequest,
  type DcLedgerAppendResponse,
  type DcLedgerChangeType,
  type DcLedgerEntry,
  type DcLedgerProvenance,
} from "../types";
import { issueWriterToken, verifyWriterToken } from "./signing";

export const AUTHORITY_RETENTION_SECONDS = KV_TTL.DECISION_AUTHORITY_RETENTION;

export class DcAuthorityError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly head: DcLedgerEntry | null;
  constructor(code: string, message: string, opts?: { retryable?: boolean; head?: DcLedgerEntry | null }) {
    super(message);
    this.name = "DcAuthorityError";
    this.code = code;
    this.retryable = opts?.retryable ?? false;
    this.head = opts?.head ?? null;
  }
}

function safe(s: string): string {
  return s.replace(/[^a-zA-Z0-9@_.:-]/g, "_");
}

export function assertSessionId(session_id: unknown): asserts session_id is string {
  if (typeof session_id !== "string" || !session_id.trim() || session_id.length > 200) {
    throw new DcAuthorityError("DC_AUTHORITY_BAD_REQUEST", "session_id required");
  }
}

const k = {
  entry: (sid: string, n: number) => `poju-auth:ledger:${safe(sid)}:e:${n}`,
  idem: (sid: string, key: string) => `poju-auth:ledger:${safe(sid)}:k:${sha256Hex(key).slice(0, 40)}`,
  head: (sid: string) => `poju-auth:ledger:${safe(sid)}:head`,
  meta: (sid: string) => `poju-auth:ledger:${safe(sid)}:meta`,
};

type LedgerMeta = { genesis_entry_hash: string };

const ex = { ex: AUTHORITY_RETENTION_SECONDS };

export async function loadLedgerEntry(session_id: string, n: number): Promise<DcLedgerEntry | null> {
  if (!Number.isSafeInteger(n) || n < 1) return null;
  const got = await durableKv().get<DcLedgerEntry>(k.entry(session_id, n));
  if (!got || got.session_id !== session_id || got.commit_version !== n) return null;
  const copy = normalizeJson(got);
  const { entry_hash, ...rest } = copy;
  if (canonicalHash(rest) !== entry_hash) {
    throw new DcAuthorityError("DC_LEDGER_ENTRY_CORRUPT", `ledger entry ${n} failed its hash check`);
  }
  return copy;
}

/** Current head: start from the hint and probe forward until an empty slot. */
export async function readLedgerHead(session_id: string): Promise<DcLedgerEntry | null> {
  const hint = await durableKv().get<{ commit_version: number }>(k.head(session_id));
  let n = hint?.commit_version && Number.isSafeInteger(hint.commit_version) ? hint.commit_version : 0;
  let head: DcLedgerEntry | null = n > 0 ? await loadLedgerEntry(session_id, n) : null;
  if (n > 0 && !head) n = 0;
  for (;;) {
    const next = await loadLedgerEntry(session_id, n + 1);
    if (!next) break;
    head = next;
    n += 1;
  }
  return head;
}

async function genesisHash(session_id: string): Promise<string | null> {
  const meta = await durableKv().get<LedgerMeta>(k.meta(session_id));
  if (meta?.genesis_entry_hash) return meta.genesis_entry_hash;
  const first = await loadLedgerEntry(session_id, 1);
  return first?.entry_hash ?? null;
}

export async function assertWriter(session_id: string, writer_token: unknown): Promise<string> {
  const g = await genesisHash(session_id);
  if (!g) throw new DcAuthorityError("DC_LEDGER_NOT_FOUND", "No ledger exists for this session");
  if (!verifyWriterToken(session_id, g, writer_token)) {
    throw new DcAuthorityError("DC_AUTHORITY_FORBIDDEN", "writer token does not match this session ledger");
  }
  return g;
}

export function writerTokenForGenesis(session_id: string, genesis_entry_hash: string): string {
  return issueWriterToken(session_id, genesis_entry_hash);
}

function sealEntry(body: Omit<DcLedgerEntry, "entry_hash">): DcLedgerEntry {
  const normalized = normalizeJson(body);
  return { ...normalized, entry_hash: canonicalHash(normalized) };
}

/** Slot-level NX write + index/head/meta upkeep. Returns null when the slot was taken. */
export async function writeLedgerEntryNx(entry: DcLedgerEntry): Promise<DcLedgerEntry | null> {
  const store = durableKv();
  const claimed = await store.set(k.entry(entry.session_id, entry.commit_version), entry, { ...ex, nx: true });
  if (claimed !== "OK") return null;
  await store.set(k.idem(entry.session_id, entry.idempotency_key), { commit_version: entry.commit_version }, {
    ...ex,
    nx: true,
  });
  await store.set(k.head(entry.session_id), { commit_version: entry.commit_version }, ex);
  if (entry.commit_version === 1) {
    await store.set(k.meta(entry.session_id), { genesis_entry_hash: entry.entry_hash } satisfies LedgerMeta, ex);
  } else {
    await store.expire(k.meta(entry.session_id), AUTHORITY_RETENTION_SECONDS);
  }
  return entry;
}

async function entryForIdempotencyKey(session_id: string, key: string): Promise<DcLedgerEntry | null> {
  const ptr = await durableKv().get<{ commit_version: number }>(k.idem(session_id, key));
  if (!ptr) return null;
  const entry = await loadLedgerEntry(session_id, ptr.commit_version);
  return entry && entry.idempotency_key === key ? entry : null;
}

/** Record "unchanged" outcomes so a later different write under the same key conflicts. */
async function pinIdempotencyKey(session_id: string, key: string, commit_version: number): Promise<void> {
  await durableKv().set(k.idem(session_id, key), { commit_version }, { ...ex, nx: true });
}

export function buildLedgerEntry(input: {
  session_id: string;
  prev: DcLedgerEntry | null;
  snapshot: DecisionContext;
  blueprint: DecisionBlueprint | null;
  idempotency_key: string;
  change_type: DcLedgerChangeType;
  committed_at: string;
  provenance: DcLedgerProvenance;
}): DcLedgerEntry {
  const snapshot = normalizeJson(input.snapshot);
  const blueprint = input.blueprint ? normalizeJson(input.blueprint) : null;
  const prev = input.prev;
  return sealEntry({
    schema_version: DC_LEDGER_SCHEMA_VERSION,
    session_id: input.session_id,
    context_id: snapshot.context_id,
    commit_version: (prev?.commit_version ?? 0) + 1,
    previous_commit_version: prev?.commit_version ?? null,
    previous_entry_hash: prev?.entry_hash ?? null,
    dc_version: snapshot.version,
    previous_dc_version: prev?.dc_version ?? null,
    dc_status: snapshot.status,
    content_hash: computeContentHash(snapshot),
    previous_content_hash: prev?.content_hash ?? null,
    snapshot_hash: dcSnapshotHash(snapshot),
    idempotency_key: input.idempotency_key,
    change_type: input.change_type,
    committed_at: input.committed_at,
    snapshot,
    blueprint_version: blueprint?.blueprint_version ?? prev?.blueprint_version ?? null,
    blueprint_hash: blueprint ? blueprintHash(blueprint) : prev?.blueprint_hash ?? null,
    blueprint: blueprint ?? prev?.blueprint ?? null,
    provenance: normalizeJson(input.provenance),
  });
}

function sameContent(entry: DcLedgerEntry, snapHash: string, bpHash: string | null): boolean {
  return entry.snapshot_hash === snapHash && (bpHash == null || entry.blueprint_hash === bpHash);
}

function okResponse(
  outcome: "committed" | "duplicate" | "unchanged",
  entry: DcLedgerEntry,
  writer_token: string,
): DcLedgerAppendResponse {
  return { ok: true, outcome, head: headRefFromEntry(entry), writer_token };
}

/**
 * Append one device DC change. Server classifies the change type and validates the
 * transition against its own head — the request's view of history is only the
 * optimistic `expected_previous` pointer.
 */
export async function appendDcLedgerCommit(
  req: DcLedgerAppendRequest,
  opts?: { now?: string },
): Promise<DcLedgerAppendResponse> {
  assertSessionId(req.session_id);
  const sid = req.session_id;
  const key = typeof req.idempotency_key === "string" ? req.idempotency_key.trim() : "";
  if (!key || key.length > 400) {
    throw new DcAuthorityError("DC_AUTHORITY_BAD_REQUEST", "idempotency_key required");
  }
  const snapshot = normalizeJson(req.snapshot);
  const blueprint = req.blueprint ? normalizeJson(req.blueprint) : null;
  const events = Array.isArray(req.confirmation_events)
    ? (normalizeJson(req.confirmation_events) as ConfirmationEvent[])
    : [];
  const snapHash = dcSnapshotHash(snapshot);
  const bpHash = blueprintHash(blueprint);

  const genesis = await genesisHash(sid);

  // Idempotency first: a retried commit returns the effective result unchanged.
  const prior = await entryForIdempotencyKey(sid, key);
  if (prior) {
    const replayOfGenesis = prior.commit_version === 1 && sameContent(prior, snapHash, bpHash);
    if (!replayOfGenesis) await assertWriter(sid, req.writer_token);
    const token = writerTokenForGenesis(sid, genesis ?? prior.entry_hash);
    if (sameContent(prior, snapHash, bpHash)) return okResponse("duplicate", prior, token);
    const head = await readLedgerHead(sid);
    return {
      ok: false,
      code: "DC_LEDGER_IDEMPOTENCY_CONFLICT",
      error: `idempotency_key already committed different content at commit ${prior.commit_version}`,
      retryable: false,
      head: head ? headRefFromEntry(head) : null,
      effective: {
        head: headRefFromEntry(prior),
        previous_entry_hash: prior.previous_entry_hash,
        snapshot: prior.snapshot,
        blueprint: prior.blueprint,
      },
    };
  }

  if (genesis) await assertWriter(sid, req.writer_token);
  const head = await readLedgerHead(sid);
  const expected = req.expected_previous ?? null;
  const headMatches = head
    ? expected != null && expected.commit_version === head.commit_version && expected.entry_hash === head.entry_hash
    : expected == null;
  if (!headMatches) {
    // A retried write whose first attempt landed but whose response was lost.
    if (head && head.idempotency_key === key && sameContent(head, snapHash, bpHash)) {
      return okResponse("duplicate", head, writerTokenForGenesis(sid, genesis ?? head.entry_hash));
    }
    throw new DcAuthorityError(
      "DC_LEDGER_HEAD_MISMATCH",
      `expected previous ${expected ? `${expected.commit_version}:${expected.entry_hash.slice(0, 12)}` : "none"} but server head is ${head ? `${head.commit_version}:${head.entry_hash.slice(0, 12)}` : "none"}`,
      { head },
    );
  }

  if (head && sameContent(head, snapHash, bpHash)) {
    await pinIdempotencyKey(sid, key, head.commit_version);
    return okResponse("unchanged", head, writerTokenForGenesis(sid, genesis ?? head.entry_hash));
  }

  let verdict;
  try {
    verdict = validateLedgerTransition({
      session_id: sid,
      prev: head,
      next: snapshot,
      blueprint,
      confirmation_events: events,
      snapshotChanged: !head || head.snapshot_hash !== snapHash,
      blueprintChanged: !head || head.blueprint_hash !== bpHash,
    });
  } catch (e) {
    if (e instanceof DcLedgerRuleError) throw new DcAuthorityError(e.code, e.message, { head });
    throw e;
  }

  const entry = buildLedgerEntry({
    session_id: sid,
    prev: head,
    snapshot,
    blueprint,
    idempotency_key: key,
    change_type: verdict.change_type,
    committed_at: opts?.now ?? new Date().toISOString(),
    provenance: {
      source_op: typeof req.source_op === "string" ? req.source_op.slice(0, 120) : "unknown",
      confirmation_events: verdict.backing_events,
      promoted_fact_ids: verdict.promoted_fact_ids,
      promoted_constraint_ids: verdict.promoted_constraint_ids,
      freeze: null,
    },
  });

  const written = await writeLedgerEntryNx(entry);
  if (written) {
    return okResponse("committed", written, writerTokenForGenesis(sid, genesis ?? written.entry_hash));
  }
  const winner = await loadLedgerEntry(sid, entry.commit_version);
  if (winner && winner.idempotency_key === key && sameContent(winner, snapHash, bpHash)) {
    return okResponse("duplicate", winner, writerTokenForGenesis(sid, genesis ?? winner.entry_hash));
  }
  throw new DcAuthorityError(
    "DC_LEDGER_CONCURRENT_COMMIT",
    `another commit took ledger slot ${entry.commit_version}`,
    { head: winner, retryable: false },
  );
}

export async function touchLedgerMeta(session_id: string): Promise<void> {
  const store = durableKv();
  await store.expire(k.meta(session_id), AUTHORITY_RETENTION_SECONDS);
  await store.expire(k.head(session_id), AUTHORITY_RETENTION_SECONDS);
}
