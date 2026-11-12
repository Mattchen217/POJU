/**
 * M4 — server Freeze seal.
 *
 * The device asks to freeze the ledger head it believes is current. The server reads
 * its own head, checks identity / version / content hash, recomputes the profile at the
 * server instant, re-runs the existing Freeze rules (freezeDecisionContext with the
 * production N/A authority builder), appends the final snapshot as a `freeze` ledger
 * commit, writes the write-once Freeze record and returns a signed receipt.
 * The device cannot produce an authoritative Freeze on its own.
 */

import { durableKv } from "@/lib/kv/client";
import { FreezeError, freezeDecisionContext } from "@/lib/poju/decision-context/freeze";
import { ProductionNaAuthorityError, buildServerFreezeNaValidationContext } from "@/lib/poju/decision-context/na-validation-from-session";
import { assertFrozenDcIntegrity, bindingFromDecisionContext } from "@/lib/poju/decision-context/read-bound";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import { freezeIdFromBinding } from "@/lib/poju/decision-intake/freeze-bound-report";
import type { POJUSessionState } from "@/lib/poju/types";
import { canonicalHash, dcSnapshotHash, normalizeJson } from "../hash";
import {
  FREEZE_RECORD_SCHEMA_VERSION,
  headRefFromEntry,
  type DcLedgerEntry,
  type FreezeAuthorityEnvelope,
  type FreezeReceipt,
  type FreezeRecord,
  type FreezeRecoverRequest,
  type FreezeRecoverResponse,
  type FreezeSealRequest,
  type FreezeSealResponse,
} from "../types";
import {
  AUTHORITY_RETENTION_SECONDS,
  DcAuthorityError,
  assertSessionId,
  assertWriter,
  buildLedgerEntry,
  loadLedgerEntry,
  readLedgerHead,
  writeLedgerEntryNx,
} from "./ledger-store";
import { computeServerProfile, loadVerifiedProfileRecord, registerServerProfile } from "./profile-authority";
import { authorityKeyId, signFreezeReceipt, verifyFreezeReceiptSignature } from "./signing";

function safe(s: string): string {
  return s.replace(/[^a-zA-Z0-9@_.:-]/g, "_");
}

function freezeKey(session_id: string, freeze_id: string): string {
  return `poju-auth:freeze:${safe(session_id)}:${safe(freeze_id)}`;
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (normalizeJson(v) as T[]) : [];
}

function sanitizeEnvelope(raw: FreezeAuthorityEnvelope | null | undefined): FreezeAuthorityEnvelope {
  const p = raw?.profile_state;
  return {
    confirmation_events: asArray(raw?.confirmation_events),
    na_declaration_actions: asArray(raw?.na_declaration_actions),
    topic_applicability_evals: asArray(raw?.topic_applicability_evals),
    profile_state: {
      selected_stored_profile_id:
        typeof p?.selected_stored_profile_id === "string" && p.selected_stored_profile_id.trim()
          ? p.selected_stored_profile_id.trim()
          : null,
      has_profile: p?.has_profile === true,
      birth_submitted_in_session: p?.birth_submitted_in_session === true,
      profile_skipped: p?.profile_skipped === true,
    },
  };
}

/** Server authority view: ledger snapshot + Session-held authority rows. Nothing else. */
function authoritySession(session_id: string, dc: DecisionContext, env: FreezeAuthorityEnvelope): POJUSessionState {
  return {
    session_id,
    decision_context: dc,
    confirmation_events: env.confirmation_events,
    na_declaration_actions: env.na_declaration_actions,
    topic_applicability_evals: env.topic_applicability_evals,
    selected_stored_profile_id: env.profile_state.selected_stored_profile_id,
    has_profile: env.profile_state.has_profile,
    birth_submitted_in_session: env.profile_state.birth_submitted_in_session,
    profile_skipped: env.profile_state.profile_skipped,
  } as POJUSessionState;
}

function receiptId(session_id: string, freeze_id: string, context_hash: string): string {
  return `frr_${canonicalHash({ session_id, freeze_id, context_hash }).slice(0, 24)}`;
}

async function loadFreezeRecordRaw(session_id: string, freeze_id: string): Promise<FreezeRecord | null> {
  const got = await durableKv().get<FreezeRecord>(freezeKey(session_id, freeze_id));
  return got ? normalizeJson(got) : null;
}

function anchorMismatch(what: string): never {
  throw new DcAuthorityError("FREEZE_ANCHOR_MISMATCH", `Freeze record does not match its ledger commit: ${what}`);
}

/**
 * The ledger commit a Freeze record claims must exist, verify, and describe exactly this
 * Freeze. A record without its anchor is not authoritative.
 */
async function assertFreezeLedgerAnchor(session_id: string, rec: FreezeRecord): Promise<void> {
  const r = rec.receipt;
  if (r.ledger_commit_version !== rec.freeze_commit_version) anchorMismatch("receipt ledger_commit_version");
  let anchor: DcLedgerEntry | null;
  try {
    anchor = await loadLedgerEntry(session_id, rec.freeze_commit_version);
  } catch (e) {
    throw new DcAuthorityError(
      "FREEZE_ANCHOR_CORRUPT",
      `Freeze ledger commit ${rec.freeze_commit_version} failed verification: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!anchor) {
    throw new DcAuthorityError("FREEZE_ANCHOR_MISSING", `Freeze ledger commit ${rec.freeze_commit_version} does not exist`);
  }
  const f = anchor.provenance?.freeze;
  if (anchor.session_id !== session_id) anchorMismatch("session_id");
  if (anchor.change_type !== "freeze" || anchor.dc_status !== "final" || !f) anchorMismatch("change_type");
  const snap = dcSnapshotHash(anchor.snapshot);
  if (anchor.snapshot_hash !== snap || snap !== dcSnapshotHash(rec.frozen_dc)) anchorMismatch("snapshot_hash");
  if (anchor.content_hash !== rec.context_hash) anchorMismatch("content_hash");
  if (anchor.context_id !== rec.context_id || anchor.dc_version !== rec.context_version) anchorMismatch("context identity");
  if ((anchor.blueprint_hash ?? null) !== (rec.blueprint_hash ?? null)) anchorMismatch("blueprint_hash");
  if (anchor.committed_at !== rec.frozen_at) anchorMismatch("committed_at");
  if (
    anchor.previous_commit_version !== rec.source_commit_version ||
    anchor.previous_entry_hash !== rec.source_entry_hash
  ) {
    anchorMismatch("source commit");
  }
  if (
    f.freeze_id !== rec.freeze_id ||
    f.source_commit_version !== rec.source_commit_version ||
    f.source_entry_hash !== rec.source_entry_hash ||
    f.frozen_at !== rec.frozen_at ||
    f.receipt_id !== r.receipt_id ||
    (f.profile_hash ?? null) !== (rec.profile_hash ?? null)
  ) {
    anchorMismatch("freeze provenance");
  }
}

/** Load a Freeze record and re-verify signature, integrity and its ledger anchor. */
export async function loadVerifiedFreezeRecord(session_id: string, freeze_id: string): Promise<FreezeRecord> {
  const rec = await loadFreezeRecordRaw(session_id, freeze_id);
  if (!rec) throw new DcAuthorityError("FREEZE_NOT_REGISTERED", `Freeze ${freeze_id} has no server record`);
  const r = rec.receipt;
  if (!verifyFreezeReceiptSignature(r)) {
    throw new DcAuthorityError("FREEZE_RECEIPT_INVALID", "stored Freeze receipt does not verify");
  }
  if (
    rec.schema_version !== FREEZE_RECORD_SCHEMA_VERSION ||
    rec.session_id !== session_id ||
    rec.freeze_id !== freeze_id
  ) {
    throw new DcAuthorityError("FREEZE_RECORD_MISMATCH", "Freeze record is not stored under its own identity");
  }
  try {
    assertFrozenDcIntegrity(rec.frozen_dc);
  } catch (e) {
    throw new DcAuthorityError("FREEZE_INTEGRITY", e instanceof Error ? e.message : String(e));
  }
  const binding = bindingFromDecisionContext(rec.frozen_dc);
  if (
    freezeIdFromBinding(binding) !== freeze_id ||
    binding.context_hash !== rec.context_hash ||
    r.session_id !== session_id ||
    r.freeze_id !== freeze_id ||
    r.context_hash !== rec.context_hash ||
    r.context_version !== rec.context_version ||
    r.context_id !== rec.context_id ||
    r.frozen_at !== rec.frozen_at ||
    (r.blueprint_hash ?? null) !== (rec.blueprint_hash ?? null)
  ) {
    throw new DcAuthorityError("FREEZE_RECORD_MISMATCH", "Freeze record does not match its receipt");
  }
  await assertFreezeLedgerAnchor(session_id, rec);
  await durableKv().expire(freezeKey(session_id, freeze_id), AUTHORITY_RETENTION_SECONDS);
  return rec;
}

/** A device-held Freeze receipt must be the server's own receipt for that record. */
export function assertFreezeReceiptMatches(held: unknown, rec: FreezeRecord): void {
  const r = held as FreezeReceipt | null;
  if (!r || typeof r !== "object" || !verifyFreezeReceiptSignature(r)) {
    throw new DcAuthorityError("FREEZE_RECEIPT_INVALID", "Freeze receipt signature does not verify");
  }
  if (r.receipt_id !== rec.receipt.receipt_id || r.signature !== rec.receipt.signature) {
    throw new DcAuthorityError("FREEZE_RECEIPT_INVALID", "Freeze receipt is not the registered receipt");
  }
}

function signReceiptForEntry(entry: DcLedgerEntry): FreezeReceipt {
  const f = entry.provenance.freeze!;
  const binding = bindingFromDecisionContext(entry.snapshot);
  return signFreezeReceipt({
    schema_version: FREEZE_RECORD_SCHEMA_VERSION,
    receipt_id: receiptId(entry.session_id, f.freeze_id, binding.context_hash),
    session_id: entry.session_id,
    freeze_id: f.freeze_id,
    context_id: entry.context_id,
    context_version: entry.dc_version,
    context_hash: binding.context_hash,
    blueprint_hash: entry.blueprint_hash,
    frozen_at: f.frozen_at,
    ledger_commit_version: entry.commit_version,
    key_id: authorityKeyId(),
  });
}

function recordFromFreezeEntry(entry: DcLedgerEntry): FreezeRecord {
  const f = entry.provenance.freeze!;
  const receipt = signReceiptForEntry(entry);
  return {
    schema_version: FREEZE_RECORD_SCHEMA_VERSION,
    session_id: entry.session_id,
    freeze_id: f.freeze_id,
    context_id: entry.context_id,
    context_version: entry.dc_version,
    context_hash: receipt.context_hash,
    frozen_at: f.frozen_at,
    frozen_dc: entry.snapshot,
    blueprint_hash: entry.blueprint_hash,
    blueprint: entry.blueprint,
    source_commit_version: f.source_commit_version,
    source_entry_hash: f.source_entry_hash,
    freeze_commit_version: entry.commit_version,
    profile_hash: f.profile_hash,
    receipt,
  };
}

/** Write-once Freeze record; an existing record must carry the same content hash. */
async function putFreezeRecord(record: FreezeRecord): Promise<void> {
  const claimed = await durableKv().set(freezeKey(record.session_id, record.freeze_id), record, {
    ex: AUTHORITY_RETENTION_SECONDS,
    nx: true,
  });
  if (claimed === "OK") return;
  const existing = await loadFreezeRecordRaw(record.session_id, record.freeze_id);
  if (!existing || existing.context_hash !== record.context_hash) {
    throw new DcAuthorityError("FREEZE_CONFLICT", `Freeze ${record.freeze_id} already sealed with different content`);
  }
}

/**
 * Replay of an already-sealed Freeze. The record (and, when birth is re-sent, the
 * profile) is re-materialized from the ledger commit if a crash lost it after the seal.
 */
/**
 * Verified Freeze record for a ledger freeze commit. A record lost after the commit is
 * re-materialized deterministically from the commit itself, then fully re-verified.
 */
async function verifiedRecordForFreezeEntry(session_id: string, entry: DcLedgerEntry): Promise<FreezeRecord> {
  const f = entry.provenance.freeze;
  if (entry.change_type !== "freeze" || !f) {
    throw new DcAuthorityError("FREEZE_ANCHOR_MISMATCH", "ledger commit is not a Freeze");
  }
  if (!(await loadFreezeRecordRaw(session_id, f.freeze_id))) {
    await putFreezeRecord(recordFromFreezeEntry(entry));
  }
  const rec = await loadVerifiedFreezeRecord(session_id, f.freeze_id);
  if (rec.freeze_commit_version !== entry.commit_version) {
    throw new DcAuthorityError("FREEZE_ANCHOR_MISMATCH", "Freeze record points at a different ledger commit");
  }
  return rec;
}

/** Registered profile receipt of a Freeze, or null when none is registered yet. */
async function registeredProfileReceipt(session_id: string, rec: FreezeRecord) {
  try {
    return (await loadVerifiedProfileRecord({ session_id, freeze: rec })).receipt;
  } catch (e) {
    if (e instanceof DcAuthorityError && e.code === "PROFILE_NOT_REGISTERED") return null;
    throw e;
  }
}

async function duplicateResponse(
  session_id: string,
  entry: DcLedgerEntry,
  profileInput: FreezeSealRequest["profile"],
): Promise<FreezeSealResponse> {
  const rec = await verifiedRecordForFreezeEntry(session_id, entry);
  let profile_receipt = await registeredProfileReceipt(session_id, rec);
  // Profile sealed with the Freeze but its record was lost: re-register only when the
  // re-sent birth input reproduces exactly the sealed profile.
  if (!profile_receipt && rec.profile_hash && profileInput?.birth_info != null) {
    const computation = await computeServerProfile(profileInput.birth_info, rec.frozen_at);
    if (!computation.ok || computation.profile_hash !== rec.profile_hash) {
      throw new DcAuthorityError("PROFILE_HASH_MISMATCH", "re-sent birth input does not reproduce the sealed profile");
    }
    profile_receipt = (
      await registerServerProfile({
        session_id,
        freeze_receipt: rec.receipt,
        profile_id: profileInput.profile_id ?? null,
        computation,
        now: rec.frozen_at,
      })
    ).record.receipt;
  }
  return {
    ok: true,
    outcome: "duplicate",
    frozen_dc: rec.frozen_dc,
    receipt: rec.receipt,
    head: headRefFromEntry(entry),
    profile_receipt,
  };
}

export async function sealFreeze(req: FreezeSealRequest, opts?: { now?: string }): Promise<FreezeSealResponse> {
  assertSessionId(req.session_id);
  const sid = req.session_id;
  await assertWriter(sid, req.writer_token);
  const expected = req.expected;
  if (!expected || typeof expected.entry_hash !== "string" || !Number.isSafeInteger(expected.commit_version)) {
    throw new DcAuthorityError("DC_AUTHORITY_BAD_REQUEST", "expected ledger head required");
  }

  const head = await readLedgerHead(sid);
  if (!head) throw new DcAuthorityError("DC_LEDGER_NOT_FOUND", "No ledger exists for this session");

  // Replay: the head is already the freeze sealed from the expected commit.
  if (
    head.change_type === "freeze" &&
    head.provenance.freeze?.source_commit_version === expected.commit_version &&
    head.provenance.freeze?.source_entry_hash === expected.entry_hash
  ) {
    return duplicateResponse(sid, head, req.profile);
  }

  if (head.commit_version !== expected.commit_version || head.entry_hash !== expected.entry_hash) {
    throw new DcAuthorityError(
      "DC_LEDGER_HEAD_MISMATCH",
      "Freeze target is not the latest committed Decision Context",
      { head },
    );
  }
  if (
    head.context_id !== expected.context_id ||
    head.dc_version !== expected.dc_version ||
    head.content_hash !== expected.content_hash
  ) {
    throw new DcAuthorityError("FREEZE_TARGET_MISMATCH", "context_id / version / content_hash differ from the ledger head");
  }
  if (head.dc_status !== "draft") {
    throw new DcAuthorityError("FREEZE_ALREADY_FROZEN", `ledger head ${head.context_id}@v${head.dc_version} is ${head.dc_status}`);
  }
  const prospectiveFreezeId = `${head.context_id}@v${head.dc_version}`;
  if (await loadFreezeRecordRaw(sid, prospectiveFreezeId)) {
    throw new DcAuthorityError("FREEZE_VERSION_ALREADY_SEALED", `${prospectiveFreezeId} was already sealed`);
  }

  const frozen_at = opts?.now ?? new Date().toISOString();
  const envelope = sanitizeEnvelope(req.authority);

  // Profile first: its outcome is the CFP authority for N/A validation.
  let computation: Awaited<ReturnType<typeof computeServerProfile>> | null = null;
  if (req.profile && req.profile.birth_info != null) {
    computation = await computeServerProfile(req.profile.birth_info, frozen_at);
    if (!computation.ok && computation.code === "PROFILE_BIRTH_INVALID") {
      throw new DcAuthorityError(computation.code, computation.error);
    }
  }
  const cfp = !computation
    ? ({ outcome: "not_supplied" } as const)
    : computation.ok
      ? ({ outcome: "ok", profile_hash: computation.profile_hash } as const)
      : ({ outcome: "calc_failed" } as const);

  const authSession = authoritySession(sid, head.snapshot, envelope);
  let frozen: DecisionContext;
  try {
    const naValidation = await buildServerFreezeNaValidationContext(authSession, { nowIso: frozen_at, cfp });
    frozen = freezeDecisionContext(head.snapshot, {
      stage3_sufficiency_end: true,
      from_purchase_or_report_cta: false,
      from_stall_or_max_turns: false,
      now: frozen_at,
      naValidation,
      expectedSessionId: sid,
    }).frozen;
  } catch (e) {
    if (e instanceof ProductionNaAuthorityError) {
      throw new DcAuthorityError(e.reason_code, e.message, { retryable: true });
    }
    if (e instanceof FreezeError) {
      throw new DcAuthorityError(e.code ?? "FREEZE_REJECTED", e.message);
    }
    throw e;
  }
  frozen = normalizeJson(frozen);
  const binding = bindingFromDecisionContext(frozen);
  const freeze_id = freezeIdFromBinding(binding);

  const profileHash = computation?.ok ? computation.profile_hash : null;
  const entry = buildLedgerEntry({
    session_id: sid,
    prev: head,
    snapshot: frozen,
    blueprint: head.blueprint,
    idempotency_key: `dc_freeze:${sid}:${head.context_id}:v${head.dc_version}:sufficiency`,
    change_type: "freeze",
    committed_at: frozen_at,
    provenance: {
      source_op: "server_freeze_seal",
      confirmation_events: [],
      promoted_fact_ids: [],
      promoted_constraint_ids: [],
      freeze: {
        freeze_id,
        source_commit_version: head.commit_version,
        source_entry_hash: head.entry_hash,
        frozen_at,
        receipt_id: receiptId(sid, freeze_id, binding.context_hash),
        profile_hash: profileHash,
      },
    },
  });
  const written = await writeLedgerEntryNx(entry);
  if (!written) {
    const winner = await loadLedgerEntry(sid, entry.commit_version);
    if (
      winner?.change_type === "freeze" &&
      winner.provenance.freeze?.source_entry_hash === head.entry_hash
    ) {
      return duplicateResponse(sid, winner, req.profile);
    }
    throw new DcAuthorityError("DC_LEDGER_CONCURRENT_COMMIT", "the ledger moved while sealing the Freeze", {
      head: winner,
    });
  }

  const record = recordFromFreezeEntry(written);
  await putFreezeRecord(record);

  let profile_receipt = null;
  if (computation?.ok) {
    const reg = await registerServerProfile({
      session_id: sid,
      freeze_receipt: record.receipt,
      profile_id: req.profile?.profile_id ?? null,
      computation,
      now: frozen_at,
    });
    profile_receipt = reg.record.receipt;
  }

  return {
    ok: true,
    outcome: "sealed",
    frozen_dc: frozen,
    receipt: record.receipt,
    head: headRefFromEntry(written),
    profile_receipt,
  };
}

function assertExpectedAnchor(expected: FreezeRecoverRequest["expected"] | null | undefined): void {
  if (
    !expected ||
    !Number.isSafeInteger(expected.commit_version) ||
    expected.commit_version < 1 ||
    typeof expected.entry_hash !== "string" ||
    !expected.entry_hash ||
    typeof expected.context_id !== "string" ||
    !expected.context_id ||
    !Number.isSafeInteger(expected.dc_version) ||
    typeof expected.content_hash !== "string" ||
    !expected.content_hash
  ) {
    throw new DcAuthorityError("DC_AUTHORITY_BAD_REQUEST", "expected draft anchor required");
  }
}

/**
 * Freeze recovery: the device still holds the draft it asked to freeze (its local
 * adoption of the sealed Freeze failed). Everything returned is rebuilt from the
 * server's own ledger; the request only names the draft commit. Recovery succeeds only
 * when that draft commit exists unchanged, the very next commit is the Freeze sealed
 * from it, and that Freeze is still the ledger head.
 */
export async function recoverFreeze(req: FreezeRecoverRequest): Promise<FreezeRecoverResponse> {
  assertSessionId(req.session_id);
  const sid = req.session_id;
  await assertWriter(sid, req.writer_token);
  assertExpectedAnchor(req.expected);
  const expected = req.expected;

  const head = await readLedgerHead(sid);
  if (!head) throw new DcAuthorityError("DC_LEDGER_NOT_FOUND", "No ledger exists for this session");

  const source = await loadLedgerEntry(sid, expected.commit_version);
  if (
    !source ||
    source.entry_hash !== expected.entry_hash ||
    source.dc_status !== "draft" ||
    source.context_id !== expected.context_id ||
    source.dc_version !== expected.dc_version ||
    source.content_hash !== expected.content_hash
  ) {
    throw new DcAuthorityError(
      "FREEZE_RECOVERY_SOURCE_MISMATCH",
      "the draft anchor does not match a draft commit in this ledger",
      { head },
    );
  }

  const sealed = await loadLedgerEntry(sid, source.commit_version + 1);
  const f = sealed?.provenance.freeze;
  if (
    !sealed ||
    sealed.change_type !== "freeze" ||
    !f ||
    f.source_commit_version !== source.commit_version ||
    f.source_entry_hash !== source.entry_hash ||
    sealed.previous_entry_hash !== source.entry_hash
  ) {
    throw new DcAuthorityError("FREEZE_RECOVERY_NOT_FOUND", "no Freeze was sealed from this draft commit", { head });
  }
  if (
    sealed.context_id !== source.context_id ||
    sealed.dc_version !== source.dc_version ||
    sealed.previous_content_hash !== source.content_hash ||
    f.freeze_id !== `${source.context_id}@v${source.dc_version}`
  ) {
    throw new DcAuthorityError("FREEZE_ANCHOR_MISMATCH", "sealed Freeze does not describe the draft it claims to seal");
  }
  if (head.commit_version !== sealed.commit_version || head.entry_hash !== sealed.entry_hash) {
    throw new DcAuthorityError(
      "FREEZE_NOT_CURRENT",
      `Freeze ${f.freeze_id} is no longer the ledger head (head is commit ${head.commit_version}, ${head.change_type})`,
      { head },
    );
  }

  const rec = await verifiedRecordForFreezeEntry(sid, sealed);
  const profile_receipt = await registeredProfileReceipt(sid, rec);
  return {
    ok: true,
    outcome: "recovered",
    frozen_dc: rec.frozen_dc,
    receipt: rec.receipt,
    head: headRefFromEntry(sealed),
    profile_receipt,
  };
}

/**
 * Register (or re-read) the profile of an existing Freeze — for a profile supplied after
 * the seal, or a lost profile receipt. Calculation time is always the Freeze instant.
 */
export async function registerProfileForFreeze(req: {
  session_id: string;
  writer_token: string;
  freeze_receipt: unknown;
  profile_id: string | null;
  birth_info: unknown;
}): Promise<{ outcome: "registered" | "duplicate"; receipt: import("../types").ProfileReceipt }> {
  assertSessionId(req.session_id);
  await assertWriter(req.session_id, req.writer_token);
  const held = req.freeze_receipt as FreezeReceipt | null;
  if (!held || typeof held.freeze_id !== "string") {
    throw new DcAuthorityError("FREEZE_RECEIPT_INVALID", "Freeze receipt required");
  }
  const rec = await loadVerifiedFreezeRecord(req.session_id, held.freeze_id);
  assertFreezeReceiptMatches(held, rec);
  const computation = await computeServerProfile(req.birth_info, rec.frozen_at);
  if (!computation.ok) throw new DcAuthorityError(computation.code, computation.error);
  if (rec.profile_hash && rec.profile_hash !== computation.profile_hash) {
    throw new DcAuthorityError(
      "PROFILE_ALREADY_REGISTERED",
      "this Freeze was sealed with a different profile; a new profile needs a new Freeze",
    );
  }
  const reg = await registerServerProfile({
    session_id: req.session_id,
    freeze_receipt: rec.receipt,
    profile_id: req.profile_id,
    computation,
  });
  return { outcome: reg.outcome, receipt: reg.record.receipt };
}
