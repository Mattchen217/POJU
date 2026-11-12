/**
 * M4 — server profile recomputation + registry.
 *
 * The device's base_analysis is never trusted. The server re-runs the formal chain on
 * the submitted birth input (shunshi-bazi-core true-solar chart → buildProfileStructured;
 * iztro Ziwei fact pack → closed-set soft labels), with the Freeze instant as the
 * calculation time. A fallback chart (engine unavailable) is a hard failure, never a
 * silent substitute. Raw birth data is not stored — only its hash.
 */

import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { calculateProfileWithShunshi } from "@/lib/calculations/shunshi-adapter";
import { durableKv } from "@/lib/kv/client";
import { computeProfileHash } from "@/lib/poju/decision-intake/personal-analysis";
import { buildZiweiFactPack } from "@/lib/ziwei/fact-pack";
import { coerceBirthInfo, formatZiweiClosedSetForPrompt } from "@/lib/ziwei/lab-ziwei";
import type { BirthInfo } from "@/lib/profile/types";
import { canonicalHash, normalizeJson } from "../hash";
import {
  PROFILE_CALC_SCHEMA_VERSION,
  PROFILE_RECORD_SCHEMA_VERSION,
  type FreezeReceipt,
  type FreezeRecord,
  type ProfileReceipt,
  type ProfileRecord,
  type ProfileSourceMetadata,
} from "../types";
import { AUTHORITY_RETENTION_SECONDS, DcAuthorityError } from "./ledger-store";
import { authorityKeyId, signProfileReceipt, verifyProfileReceiptSignature } from "./signing";

export type ServerProfileComputation =
  | {
      ok: true;
      structured: ProfileStructured;
      ziwei_closed_set: string | null;
      profile_hash: string;
      calculation_timestamp: string;
      source: ProfileSourceMetadata;
    }
  | { ok: false; code: "PROFILE_BIRTH_INVALID" | "PROFILE_CALC_FAILED"; error: string };

function safe(s: string): string {
  return s.replace(/[^a-zA-Z0-9@_.:-]/g, "_");
}

function profileKey(session_id: string, freeze_id: string): string {
  return `poju-auth:profile:${safe(session_id)}:${safe(freeze_id)}`;
}

/** Hash of the coerced birth fields that drive the calculation (no raw storage). */
export function birthInputHash(birth: BirthInfo): string {
  return canonicalHash({ schema: PROFILE_CALC_SCHEMA_VERSION, birth });
}

export async function computeServerProfile(
  rawBirth: unknown,
  calculation_timestamp: string,
): Promise<ServerProfileComputation> {
  const birth = coerceBirthInfo(rawBirth);
  if (!birth) {
    return { ok: false, code: "PROFILE_BIRTH_INVALID", error: "birth input is incomplete or malformed" };
  }
  // tst_meta is a derived output; the server recomputes it.
  const { tst_meta: _derived, ...calcBirth } = birth;
  const input = calcBirth as BirthInfo;
  let structured: ProfileStructured;
  let used_true_solar_time = false;
  try {
    const profile = await calculateProfileWithShunshi(input, { quiet: true });
    if (profile.source !== "shunshi") {
      return { ok: false, code: "PROFILE_CALC_FAILED", error: "chart engine unavailable (no fallback chart accepted)" };
    }
    used_true_solar_time = profile.used_true_solar_time === true;
    structured = buildStreamLocalDataFromProfile(profile).structured;
  } catch (e) {
    return {
      ok: false,
      code: "PROFILE_CALC_FAILED",
      error: e instanceof Error ? e.message.slice(0, 200) : "chart calculation failed",
    };
  }
  if (!structured?.day_master?.trim()) {
    return { ok: false, code: "PROFILE_CALC_FAILED", error: "chart calculation produced no day structure" };
  }
  let ziwei_closed_set: string | null = null;
  let ziwei_status: ProfileSourceMetadata["ziwei_status"] = "not_available";
  try {
    const block = formatZiweiClosedSetForPrompt(buildZiweiFactPack(input, { asOf: calculation_timestamp }));
    ziwei_closed_set = block.trim() ? block : null;
    ziwei_status = ziwei_closed_set ? "ok" : "not_available";
  } catch {
    ziwei_status = "failed";
  }
  structured = normalizeJson(structured);
  return {
    ok: true,
    structured,
    ziwei_closed_set,
    calculation_timestamp,
    profile_hash: computeProfileHash({
      structured,
      ziwei_closed_set,
      calculation_schema_version: PROFILE_CALC_SCHEMA_VERSION,
      calculation_timestamp,
    }),
    source: {
      kind: "server_recompute_from_birth",
      birth_input_hash: birthInputHash(input),
      bazi_engine: "shunshi-bazi-core",
      ziwei_engine: "iztro",
      used_true_solar_time,
      ziwei_status,
    },
  };
}

/** Register the recomputed profile for one Freeze. One profile per Freeze; first wins. */
export async function registerServerProfile(input: {
  session_id: string;
  freeze_receipt: FreezeReceipt;
  profile_id: string | null;
  computation: Extract<ServerProfileComputation, { ok: true }>;
  now?: string;
}): Promise<{ record: ProfileRecord; outcome: "registered" | "duplicate" }> {
  const { session_id, freeze_receipt, computation } = input;
  if (computation.calculation_timestamp !== freeze_receipt.frozen_at) {
    throw new DcAuthorityError("PROFILE_TIME_MISMATCH", "profile must be calculated at the Freeze instant");
  }
  const receipt = signProfileReceipt({
    schema_version: PROFILE_RECORD_SCHEMA_VERSION,
    receipt_id: `prr_${canonicalHash({ session_id, freeze_id: freeze_receipt.freeze_id, h: computation.profile_hash }).slice(0, 24)}`,
    session_id,
    freeze_id: freeze_receipt.freeze_id,
    profile_id: input.profile_id,
    profile_hash: computation.profile_hash,
    calculation_schema_version: PROFILE_CALC_SCHEMA_VERSION,
    calculation_timestamp: computation.calculation_timestamp,
    key_id: authorityKeyId(),
  });
  const record: ProfileRecord = {
    schema_version: PROFILE_RECORD_SCHEMA_VERSION,
    session_id,
    freeze_id: freeze_receipt.freeze_id,
    profile_id: input.profile_id,
    profile_hash: computation.profile_hash,
    calculation_schema_version: PROFILE_CALC_SCHEMA_VERSION,
    calculation_timestamp: computation.calculation_timestamp,
    chart_structure: computation.structured,
    ziwei_closed_set: computation.ziwei_closed_set,
    source: computation.source,
    registered_at: input.now ?? new Date().toISOString(),
    receipt,
  };
  const key = profileKey(session_id, freeze_receipt.freeze_id);
  const store = durableKv();
  const claimed = await store.set(key, record, { ex: AUTHORITY_RETENTION_SECONDS, nx: true });
  if (claimed === "OK") return { record, outcome: "registered" };
  const existing = await loadProfileRecordRaw(session_id, freeze_receipt.freeze_id);
  if (!existing) throw new DcAuthorityError("PROFILE_REGISTRY_RACE", "profile registry write race", { retryable: true });
  if (existing.profile_hash !== computation.profile_hash) {
    throw new DcAuthorityError(
      "PROFILE_ALREADY_REGISTERED",
      "this Freeze already has a different registered profile; a new profile needs a new Freeze",
    );
  }
  return { record: existing, outcome: "duplicate" };
}

async function loadProfileRecordRaw(session_id: string, freeze_id: string): Promise<ProfileRecord | null> {
  const got = await durableKv().get<ProfileRecord>(profileKey(session_id, freeze_id));
  return got ? normalizeJson(got) : null;
}

/**
 * Load + re-verify the profile record of a verified Freeze: identity binding to that
 * Freeze (session, freeze_id, the profile sealed with it), signature, schema, the Freeze
 * instant and a hash recomputed over the stored result.
 */
export async function loadVerifiedProfileRecord(input: {
  session_id: string;
  /** Already-verified Freeze record this profile belongs to. */
  freeze: Pick<FreezeRecord, "session_id" | "freeze_id" | "frozen_at" | "profile_hash">;
  profile_hash?: string;
}): Promise<ProfileRecord> {
  const { freeze } = input;
  if (freeze.session_id !== input.session_id) {
    throw new DcAuthorityError("PROFILE_FREEZE_MISMATCH", "Freeze belongs to another session");
  }
  const rec = await loadProfileRecordRaw(input.session_id, freeze.freeze_id);
  if (!rec) {
    throw new DcAuthorityError("PROFILE_NOT_REGISTERED", "no server-computed profile is registered for this Freeze");
  }
  if (
    rec.schema_version !== PROFILE_RECORD_SCHEMA_VERSION ||
    rec.session_id !== input.session_id ||
    rec.freeze_id !== freeze.freeze_id
  ) {
    throw new DcAuthorityError("PROFILE_FREEZE_MISMATCH", "profile record is not bound to this Freeze");
  }
  if (freeze.profile_hash && rec.profile_hash !== freeze.profile_hash) {
    throw new DcAuthorityError("PROFILE_FREEZE_MISMATCH", "registered profile differs from the profile sealed with the Freeze");
  }
  if (input.profile_hash && rec.profile_hash !== input.profile_hash) {
    throw new DcAuthorityError("PROFILE_HASH_MISMATCH", "registered profile differs from the requested profile");
  }
  if (rec.calculation_schema_version !== PROFILE_CALC_SCHEMA_VERSION) {
    throw new DcAuthorityError("PROFILE_SCHEMA_STALE", `profile schema ${rec.calculation_schema_version} is not current`);
  }
  if (rec.calculation_timestamp !== freeze.frozen_at) {
    throw new DcAuthorityError("PROFILE_TIME_MISMATCH", "profile calculation time differs from the Freeze instant");
  }
  const recomputed = computeProfileHash({
    structured: rec.chart_structure,
    ziwei_closed_set: rec.ziwei_closed_set,
    calculation_schema_version: rec.calculation_schema_version,
    calculation_timestamp: rec.calculation_timestamp,
  });
  if (recomputed !== rec.profile_hash) {
    throw new DcAuthorityError("PROFILE_HASH_MISMATCH", "stored profile failed its hash check");
  }
  const r = rec.receipt;
  if (
    !verifyProfileReceiptSignature(r) ||
    r.schema_version !== PROFILE_RECORD_SCHEMA_VERSION ||
    r.session_id !== rec.session_id ||
    r.freeze_id !== rec.freeze_id ||
    r.profile_id !== rec.profile_id ||
    r.profile_hash !== rec.profile_hash ||
    r.calculation_timestamp !== rec.calculation_timestamp ||
    r.calculation_schema_version !== rec.calculation_schema_version
  ) {
    throw new DcAuthorityError("PROFILE_RECEIPT_INVALID", "stored profile receipt does not verify");
  }
  await durableKv().expire(profileKey(input.session_id, freeze.freeze_id), AUTHORITY_RETENTION_SECONDS);
  return rec;
}

/** A device-held profile receipt must be the server's own, field for field. */
export function assertProfileReceiptMatches(held: unknown, rec: ProfileRecord): void {
  const r = held as ProfileReceipt | null;
  if (!r || typeof r !== "object" || !verifyProfileReceiptSignature(r)) {
    throw new DcAuthorityError("PROFILE_RECEIPT_INVALID", "profile receipt signature does not verify");
  }
  if (r.receipt_id !== rec.receipt.receipt_id || r.signature !== rec.receipt.signature) {
    throw new DcAuthorityError("PROFILE_RECEIPT_INVALID", "profile receipt is not the registered receipt");
  }
}
