/**
 * Live CFP source-state reader for Intake N/A authority (S9-B / S9-R3).
 *
 * Identity binding comes only from Session SoT. Never accepts client cfpSourceState.
 * Reads outer IndexedDB StoredProfileRecord.birth_info_hash + decrypted StoredProfileData,
 * recomputes hash from birth_info, and compares. Missing/mismatch → source_provenance_missing.
 *
 * getStoredProfileWithRecord is browser/IndexedDB-only (Never Stored server-side) — when the
 * runtime cannot read device profile data, returns ok:false (fail-closed), never
 * invents source_absent_not_supplied.
 *
 * Re-read on every production compose. Do not cache on Session / DC / agent_v2.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import {
  computeStoredBirthInfoHash,
  getStoredProfileWithRecord,
  type StoredProfileWithRecord,
} from "@/lib/profile/stored-profiles-service";
import type { StoredProfileData, StoredProfileRecord } from "@/lib/db/poju-db";
import { buildChartFactPack } from "@/lib/llm/pro/delivery/page-schema/chart-fact-pack";

export const CFP_SOURCE_CODE_CHART_FACT_PACK = "cfp.chart_fact_pack" as const;

export type LiveCfpSourceState =
  | "source_ok"
  | "source_absent_not_supplied"
  | "source_calc_failed"
  | "source_provenance_missing";

export type LiveCfpEvaluation = {
  state: LiveCfpSourceState;
  eval_id: string;
  source_code: typeof CFP_SOURCE_CODE_CHART_FACT_PACK;
  profile_id: string | null;
  session_id: string;
};

export type LiveCfpSourceReadResult =
  | ({
      ok: true;
    } & LiveCfpEvaluation)
  | {
      ok: false;
      reason_code:
        | "cfp_identity_mismatch"
        | "cfp_reader_unavailable"
        | "cfp_read_failed"
        | "cfp_session_id_missing";
    };

export type LiveCfpReaderDeps = {
  /**
   * Override for tests only — must return real Record + decrypted data shapes.
   * Production composer never forwards caller deps.
   */
  getStoredProfileWithRecord?: (
    profileId: string,
  ) => Promise<StoredProfileWithRecord | null>;
  /** Override browser detection for tests. */
  isBrowser?: () => boolean;
  /** Optional wall clock for eval_id stability in tests. */
  nowIso?: string;
};

function defaultIsBrowser(): boolean {
  return typeof window !== "undefined";
}

function neverSupplied(session: POJUSessionState): boolean {
  const selected = session.selected_stored_profile_id?.trim() ?? "";
  if (selected) return false;
  if (session.has_profile) return false;
  if (session.birth_submitted_in_session) return false;
  return session.profile_skipped === true;
}

function identityMismatch(session: POJUSessionState): boolean {
  const selected = session.selected_stored_profile_id?.trim() ?? "";
  if (session.profile_skipped && (selected || session.has_profile)) {
    return true;
  }
  if (
    session.has_profile &&
    !selected &&
    !session.birth_submitted_in_session
  ) {
    return true;
  }
  return false;
}

function hasUsableStructured(data: StoredProfileData): boolean {
  const structured = data.base_analysis?.structured;
  if (!structured) return false;
  const day = structured.day_master?.trim();
  return Boolean(day);
}

function okEval(
  sessionId: string,
  state: LiveCfpSourceState,
  evalId: string,
  profileId: string | null,
): LiveCfpSourceReadResult {
  return {
    ok: true,
    state,
    eval_id: evalId,
    source_code: CFP_SOURCE_CODE_CHART_FACT_PACK,
    profile_id: profileId,
    session_id: sessionId,
  };
}

/**
 * Live read. Priority:
 * 1. identity mismatch → ok:false
 * 2. never supplied → source_absent_not_supplied
 * 3. reader unavailable → ok:false
 * 4. inputs present but calc/structure fail → source_calc_failed
 * 5. missing/mismatched Record birth_info_hash provenance → source_provenance_missing
 * 6. otherwise source_ok
 */
export async function readLiveCfpSourceState(
  session: POJUSessionState,
  deps: LiveCfpReaderDeps = {},
): Promise<LiveCfpSourceReadResult> {
  const sessionId = session.session_id?.trim() ?? "";
  if (!sessionId) {
    return { ok: false, reason_code: "cfp_session_id_missing" };
  }

  if (identityMismatch(session)) {
    return { ok: false, reason_code: "cfp_identity_mismatch" };
  }

  if (neverSupplied(session)) {
    const now = deps.nowIso ?? new Date().toISOString();
    return okEval(
      sessionId,
      "source_absent_not_supplied",
      `cfp_eval_absent_${sessionId}_${now}`,
      null,
    );
  }

  const isBrowser = deps.isBrowser ?? defaultIsBrowser;
  if (!isBrowser()) {
    return { ok: false, reason_code: "cfp_reader_unavailable" };
  }

  const selected = session.selected_stored_profile_id?.trim() ?? "";
  if (!selected) {
    return { ok: false, reason_code: "cfp_reader_unavailable" };
  }

  const getter = deps.getStoredProfileWithRecord ?? getStoredProfileWithRecord;
  let loaded: StoredProfileWithRecord | null;
  try {
    loaded = await getter(selected);
  } catch {
    return { ok: false, reason_code: "cfp_read_failed" };
  }

  if (!loaded) {
    return okEval(
      sessionId,
      "source_calc_failed",
      `cfp_eval_calc_fail_${sessionId}_${selected}`,
      selected,
    );
  }

  const { record, data } = loaded;
  if (record.profile_id !== selected) {
    return { ok: false, reason_code: "cfp_identity_mismatch" };
  }

  const recordHash =
    typeof record.birth_info_hash === "string" ? record.birth_info_hash.trim() : "";
  if (!recordHash) {
    return okEval(
      sessionId,
      "source_provenance_missing",
      `cfp_eval_prov_miss_${sessionId}_${selected}`,
      selected,
    );
  }

  let recomputed: string;
  try {
    recomputed = await computeStoredBirthInfoHash(data.birth_info);
  } catch {
    return okEval(
      sessionId,
      "source_provenance_missing",
      `cfp_eval_prov_miss_${sessionId}_${selected}`,
      selected,
    );
  }
  if (!recomputed || recomputed !== recordHash) {
    return okEval(
      sessionId,
      "source_provenance_missing",
      `cfp_eval_prov_miss_${sessionId}_${selected}`,
      selected,
    );
  }

  if (!data.base_analysis || !hasUsableStructured(data)) {
    return okEval(
      sessionId,
      "source_calc_failed",
      `cfp_eval_calc_fail_${sessionId}_${selected}`,
      selected,
    );
  }

  try {
    const pack = buildChartFactPack(data.base_analysis.structured!);
    if (!pack.day_master?.trim()) {
      return okEval(
        sessionId,
        "source_provenance_missing",
        `cfp_eval_prov_miss_${sessionId}_${selected}`,
        selected,
      );
    }
    return okEval(
      sessionId,
      "source_ok",
      `cfp_eval_ok_${sessionId}_${selected}`,
      selected,
    );
  } catch {
    return okEval(
      sessionId,
      "source_calc_failed",
      `cfp_eval_calc_fail_${sessionId}_${selected}`,
      selected,
    );
  }
}

/** Test helper: build a minimal StoredProfileRecord shell with a real birth_info_hash. */
export function testStoredProfileRecordShell(
  profileId: string,
  birthInfoHash: string,
  overrides: Partial<StoredProfileRecord> = {},
): StoredProfileRecord {
  const now = new Date();
  return {
    profile_id: profileId,
    device_id: "test_device",
    display_name: "test",
    birth_info_hash: birthInfoHash,
    relationship: "self",
    encrypted_data: "",
    iv: "",
    created_at: now,
    last_used_at: now,
    used_in_products: { poju: 0, glyph: 0, syncro: 0, match: 0, atmos: 0 },
    has_base_analysis: true,
    ...overrides,
  };
}
