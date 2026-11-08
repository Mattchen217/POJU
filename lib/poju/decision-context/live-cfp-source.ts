/**
 * Live CFP source-state reader for Intake N/A authority (S9-B).
 *
 * Identity binding comes only from Session SoT. Never accepts client cfpSourceState.
 * getStoredProfile is browser/IndexedDB-only (Never Stored server-side) — when the
 * runtime cannot read device profile data, returns ok:false (fail-closed), never
 * invents source_absent_not_supplied.
 *
 * Re-read on every production compose. Do not cache on Session / DC / agent_v2.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { buildChartFactPack } from "@/lib/llm/pro/delivery/page-schema/chart-fact-pack";

export const CFP_SOURCE_CODE_CHART_FACT_PACK = "cfp.chart_fact_pack" as const;

export type LiveCfpSourceState =
  | "source_ok"
  | "source_absent_not_supplied"
  | "source_calc_failed"
  | "source_provenance_missing";

export type LiveCfpSourceReadResult =
  | {
      ok: true;
      state: LiveCfpSourceState;
      eval_id: string;
      source_code: typeof CFP_SOURCE_CODE_CHART_FACT_PACK;
      profile_id: string | null;
    }
  | {
      ok: false;
      reason_code:
        | "cfp_identity_mismatch"
        | "cfp_reader_unavailable"
        | "cfp_read_failed"
        | "cfp_session_id_missing";
    };

export type LiveCfpReaderDeps = {
  /** Override for tests only — production composer never forwards caller deps. */
  getStoredProfile?: (profileId: string) => Promise<StoredProfileData | null>;
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
  // Explicit skip with no profile identity is the only absent path.
  return session.profile_skipped === true;
}

function identityMismatch(session: POJUSessionState): boolean {
  const selected = session.selected_stored_profile_id?.trim() ?? "";
  // Skipped but still bound to a stored profile / has_profile — inconsistent.
  if (session.profile_skipped && (selected || session.has_profile)) {
    return true;
  }
  // Claimed has_profile without any selected id and without in-session birth.
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

/**
 * Live read. Priority:
 * 1. identity mismatch → ok:false
 * 2. inputs present but calc/structure fail → source_calc_failed
 * 3. data without required provenance → source_provenance_missing
 * 4. never supplied → source_absent_not_supplied
 * 5. otherwise source_ok
 */
export async function readLiveCfpSourceState(
  session: POJUSessionState,
  deps: LiveCfpReaderDeps = {},
): Promise<LiveCfpSourceReadResult> {
  if (!session.session_id?.trim()) {
    return { ok: false, reason_code: "cfp_session_id_missing" };
  }

  if (identityMismatch(session)) {
    return { ok: false, reason_code: "cfp_identity_mismatch" };
  }

  if (neverSupplied(session)) {
    const now = deps.nowIso ?? new Date().toISOString();
    return {
      ok: true,
      state: "source_absent_not_supplied",
      eval_id: `cfp_eval_absent_${session.session_id}_${now}`,
      source_code: CFP_SOURCE_CODE_CHART_FACT_PACK,
      profile_id: null,
    };
  }

  const isBrowser = deps.isBrowser ?? defaultIsBrowser;
  if (!isBrowser()) {
    // Never Stored: server/Node cannot read device IndexedDB.
    return { ok: false, reason_code: "cfp_reader_unavailable" };
  }

  const selected = session.selected_stored_profile_id?.trim() ?? "";
  if (!selected) {
    // Expected a profile path but no id to read — not "never supplied".
    return { ok: false, reason_code: "cfp_reader_unavailable" };
  }

  const getter = deps.getStoredProfile ?? getStoredProfile;
  let profile: StoredProfileData | null;
  try {
    profile = await getter(selected);
  } catch {
    return { ok: false, reason_code: "cfp_read_failed" };
  }

  if (!profile) {
    // Bound id but row missing / decrypt failed / ownership miss.
    return {
      ok: true,
      state: "source_calc_failed",
      eval_id: `cfp_eval_calc_fail_${session.session_id}_${selected}`,
      source_code: CFP_SOURCE_CODE_CHART_FACT_PACK,
      profile_id: selected,
    };
  }

  if (!hasUsableStructured(profile)) {
    return {
      ok: true,
      state: "source_calc_failed",
      eval_id: `cfp_eval_calc_fail_${session.session_id}_${selected}`,
      source_code: CFP_SOURCE_CODE_CHART_FACT_PACK,
      profile_id: selected,
    };
  }

  const birthHash = (profile as { birth_info_hash?: string }).birth_info_hash;
  // Provenance: require structured + non-empty birth hash when present on decrypted blob.
  // StoredProfileData may carry hash only on the IndexedDB record; if structured exists
  // but chart pack cannot be built, treat as calc_failed; if pack builds but day_master
  // empty after build — provenance_missing.
  try {
    const pack = buildChartFactPack(profile.base_analysis!.structured!);
    if (!pack.day_master?.trim()) {
      return {
        ok: true,
        state: "source_provenance_missing",
        eval_id: `cfp_eval_prov_miss_${session.session_id}_${selected}`,
        source_code: CFP_SOURCE_CODE_CHART_FACT_PACK,
        profile_id: selected,
      };
    }
    // Optional stricter provenance when hash field exists on data blob.
    const dataHash =
      typeof (profile as { content_hash?: string }).content_hash === "string"
        ? (profile as { content_hash?: string }).content_hash
        : birthHash;
    if (dataHash !== undefined && dataHash !== null && String(dataHash).trim() === "") {
      return {
        ok: true,
        state: "source_provenance_missing",
        eval_id: `cfp_eval_prov_miss_${session.session_id}_${selected}`,
        source_code: CFP_SOURCE_CODE_CHART_FACT_PACK,
        profile_id: selected,
      };
    }
    return {
      ok: true,
      state: "source_ok",
      eval_id: `cfp_eval_ok_${session.session_id}_${selected}`,
      source_code: CFP_SOURCE_CODE_CHART_FACT_PACK,
      profile_id: selected,
    };
  } catch {
    return {
      ok: true,
      state: "source_calc_failed",
      eval_id: `cfp_eval_calc_fail_${session.session_id}_${selected}`,
      source_code: CFP_SOURCE_CODE_CHART_FACT_PACK,
      profile_id: selected,
    };
  }
}
