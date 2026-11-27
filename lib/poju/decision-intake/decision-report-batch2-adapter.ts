/**
 * Unit A — DI2 → Batch 2 input adapter (mapping only).
 *
 * Receives already-verified Freeze / Profile / optional packs and produces
 * ReportBatch2JobInputs. Does not authorize, create jobs, lock sessions,
 * charge, dispatch orchestrators, or call models.
 *
 * Schema gap (documented, not invented):
 * - BookJudgmentPack ≠ ProfileRecord. Pack is only accepted when the caller
 *   supplies a schema-valid pack; Profile is never cast to BookJudgmentPack.
 * - ZiweiFactPack cannot be rebuilt from ProfileRecord (raw birth is not
 *   stored — only birth_input_hash + ziwei_closed_set prompt text).
 */

import {
  BookJudgmentPackSchema,
  type BookJudgmentPack,
} from "@/lib/llm/pro/delivery/book-judgment/schema";
import { buildChartFactPack } from "@/lib/llm/pro/delivery/page-schema/chart-fact-pack";
import type { ReportBatch2JobInputs } from "@/lib/llm/pro/delivery/decision-report-v2/batch2/types";
import type {
  FreezeRecord,
  ProfileRecord,
} from "@/lib/poju/decision-authority/types";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";

export type Di2Batch2AdapterIdentity = {
  session_id: string;
  freeze_id: string;
  context_id: string;
  context_version: number;
  context_hash: string;
  profile_hash: string;
  /** DI2 stable report delivery identity → Batch2 report_id. */
  report_job_id: string;
};

/**
 * Already-verified DI2 sources. Adapter never loads or re-authorizes these.
 */
export type Di2Batch2AdapterSource = {
  identity: Di2Batch2AdapterIdentity;
  freeze: FreezeRecord;
  profile: ProfileRecord;
  /**
   * Optional verified BookJudgmentPack. Must already be a real pack artifact —
   * never a ProfileRecord cast. Absent ⇒ pack=null (Batch2 allows null).
   */
  book_judgment_pack?: BookJudgmentPack | null;
  /**
   * Optional verified ZiweiFactPack. Cannot be derived from Profile alone.
   */
  ziwei_fact_pack?: ZiweiFactPack | null;
  /**
   * Already-verified partner-profile authorization. Never inferred here.
   */
  authorized_partner_profile?: boolean;
};

export type Di2Batch2AdapterErrorCode =
  | "missing_freeze"
  | "missing_frozen_dc"
  | "missing_profile"
  | "missing_report_job_id"
  | "freeze_identity_mismatch"
  | "profile_identity_mismatch"
  | "context_hash_mismatch"
  | "invalid_book_judgment_pack"
  | "chart_fact_pack_build_failed"
  | "ziwei_fact_pack_invalid";

export type Di2Batch2AdapterResult =
  | {
      ok: true;
      inputs: ReportBatch2JobInputs;
      /** Traceable field provenance for audits / Unit A receipt. */
      provenance: Di2Batch2FieldProvenance;
    }
  | {
      ok: false;
      code: Di2Batch2AdapterErrorCode;
      detail: string;
    };

export type Di2Batch2FieldProvenance = {
  dc: "freeze.frozen_dc";
  pack:
    | "caller.book_judgment_pack"
    | "absent→null (Profile≠BookJudgmentPack)";
  chart_fact_pack:
    | "buildChartFactPack(profile.chart_structure)"
    | "absent→null (no day_master)";
  ziwei_fact_pack:
    | "caller.ziwei_fact_pack"
    | "absent→null (no raw birth on ProfileRecord)";
  report_id: "identity.report_job_id";
  bazi_available: "derived from chart_fact_pack";
  ziwei_available: "derived from ziwei_fact_pack";
  authorized_partner_profile: "caller.authorized_partner_profile|false";
};

function nonEmpty(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function assertFreezeMatchesIdentity(
  freeze: FreezeRecord,
  identity: Di2Batch2AdapterIdentity,
): Di2Batch2AdapterResult | null {
  if (freeze.session_id !== identity.session_id) {
    return {
      ok: false,
      code: "freeze_identity_mismatch",
      detail: `freeze.session_id≠identity.session_id`,
    };
  }
  if (freeze.freeze_id !== identity.freeze_id) {
    return {
      ok: false,
      code: "freeze_identity_mismatch",
      detail: `freeze.freeze_id≠identity.freeze_id`,
    };
  }
  if (freeze.context_id !== identity.context_id) {
    return {
      ok: false,
      code: "freeze_identity_mismatch",
      detail: `freeze.context_id≠identity.context_id`,
    };
  }
  if (freeze.context_version !== identity.context_version) {
    return {
      ok: false,
      code: "freeze_identity_mismatch",
      detail: `freeze.context_version≠identity.context_version`,
    };
  }
  if (freeze.context_hash !== identity.context_hash) {
    return {
      ok: false,
      code: "context_hash_mismatch",
      detail: `freeze.context_hash≠identity.context_hash`,
    };
  }
  const dc = freeze.frozen_dc;
  if (!dc || typeof dc !== "object") {
    return {
      ok: false,
      code: "missing_frozen_dc",
      detail: "freeze.frozen_dc missing",
    };
  }
  // Prefer DC's own content_hash when present; must match sealed Freeze hash.
  if (nonEmpty(dc.content_hash) && dc.content_hash !== identity.context_hash) {
    return {
      ok: false,
      code: "context_hash_mismatch",
      detail: `frozen_dc.content_hash≠identity.context_hash`,
    };
  }
  return null;
}

function assertProfileMatchesIdentity(
  profile: ProfileRecord,
  identity: Di2Batch2AdapterIdentity,
): Di2Batch2AdapterResult | null {
  if (profile.session_id !== identity.session_id) {
    return {
      ok: false,
      code: "profile_identity_mismatch",
      detail: `profile.session_id≠identity.session_id`,
    };
  }
  if (profile.freeze_id !== identity.freeze_id) {
    return {
      ok: false,
      code: "profile_identity_mismatch",
      detail: `profile.freeze_id≠identity.freeze_id`,
    };
  }
  if (profile.profile_hash !== identity.profile_hash) {
    return {
      ok: false,
      code: "profile_identity_mismatch",
      detail: `profile.profile_hash≠identity.profile_hash`,
    };
  }
  return null;
}

function resolvePack(
  raw: BookJudgmentPack | null | undefined,
):
  | { ok: true; pack: BookJudgmentPack | null; provenance: Di2Batch2FieldProvenance["pack"] }
  | { ok: false; code: Di2Batch2AdapterErrorCode; detail: string } {
  if (raw == null) {
    return {
      ok: true,
      pack: null,
      provenance: "absent→null (Profile≠BookJudgmentPack)",
    };
  }
  // Schema-only gate — do not run full quota/validate (that belongs to pack
  // generation). Reject empty objects and Profile-shaped casts.
  const parsed = BookJudgmentPackSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_book_judgment_pack",
      detail: parsed.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    };
  }
  return {
    ok: true,
    pack: parsed.data,
    provenance: "caller.book_judgment_pack",
  };
}

function resolveChartFactPack(
  profile: ProfileRecord,
):
  | {
      ok: true;
      chart_fact_pack: string | null;
      provenance: Di2Batch2FieldProvenance["chart_fact_pack"];
    }
  | { ok: false; code: Di2Batch2AdapterErrorCode; detail: string } {
  const structured = profile.chart_structure;
  if (!structured?.day_master?.trim()) {
    return {
      ok: true,
      chart_fact_pack: null,
      provenance: "absent→null (no day_master)",
    };
  }
  try {
    const built = buildChartFactPack(structured, {
      as_of: new Date(profile.calculation_timestamp),
    });
    const text = built.text?.trim() ?? "";
    if (!text) {
      return {
        ok: true,
        chart_fact_pack: null,
        provenance: "absent→null (no day_master)",
      };
    }
    return {
      ok: true,
      chart_fact_pack: text,
      provenance: "buildChartFactPack(profile.chart_structure)",
    };
  } catch (err) {
    return {
      ok: false,
      code: "chart_fact_pack_build_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function resolveZiweiFactPack(
  raw: ZiweiFactPack | null | undefined,
):
  | {
      ok: true;
      ziwei_fact_pack: ZiweiFactPack | null;
      provenance: Di2Batch2FieldProvenance["ziwei_fact_pack"];
    }
  | { ok: false; code: Di2Batch2AdapterErrorCode; detail: string } {
  if (raw == null) {
    return {
      ok: true,
      ziwei_fact_pack: null,
      provenance: "absent→null (no raw birth on ProfileRecord)",
    };
  }
  // Minimal structural gate — full ZFP rebuild requires birth (not on Profile).
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      code: "ziwei_fact_pack_invalid",
      detail: "ziwei_fact_pack must be a non-null object",
    };
  }
  return {
    ok: true,
    ziwei_fact_pack: raw,
    provenance: "caller.ziwei_fact_pack",
  };
}

/**
 * Map verified DI2 Freeze/Profile (+ optional packs) to Batch2 job inputs.
 * Fail closed on identity mismatch or corrupt required materials.
 */
export function buildBatch2InputsFromDI2(
  source: Di2Batch2AdapterSource,
): Di2Batch2AdapterResult {
  const { identity } = source;
  if (!nonEmpty(identity.report_job_id)) {
    return {
      ok: false,
      code: "missing_report_job_id",
      detail: "identity.report_job_id is required as Batch2 report_id",
    };
  }
  if (!source.freeze) {
    return { ok: false, code: "missing_freeze", detail: "freeze record required" };
  }
  if (!source.profile) {
    return {
      ok: false,
      code: "missing_profile",
      detail: "verified profile record required",
    };
  }

  const freezeErr = assertFreezeMatchesIdentity(source.freeze, identity);
  if (freezeErr) return freezeErr;
  const profileErr = assertProfileMatchesIdentity(source.profile, identity);
  if (profileErr) return profileErr;

  const dc: DecisionContext = source.freeze.frozen_dc;

  const packRes = resolvePack(source.book_judgment_pack);
  if (!packRes.ok) return packRes;

  const chartRes = resolveChartFactPack(source.profile);
  if (!chartRes.ok) return chartRes;

  const ziweiRes = resolveZiweiFactPack(source.ziwei_fact_pack);
  if (!ziweiRes.ok) return ziweiRes;

  const authorized =
    source.authorized_partner_profile === true ? true : false;

  const inputs: ReportBatch2JobInputs = {
    dc,
    pack: packRes.pack,
    chart_fact_pack: chartRes.chart_fact_pack,
    ziwei_fact_pack: ziweiRes.ziwei_fact_pack,
    report_id: identity.report_job_id.trim(),
    bazi_available: Boolean(chartRes.chart_fact_pack),
    ziwei_available: Boolean(ziweiRes.ziwei_fact_pack),
    authorized_partner_profile: authorized,
  };

  return {
    ok: true,
    inputs,
    provenance: {
      dc: "freeze.frozen_dc",
      pack: packRes.provenance,
      chart_fact_pack: chartRes.provenance,
      ziwei_fact_pack: ziweiRes.provenance,
      report_id: "identity.report_job_id",
      bazi_available: "derived from chart_fact_pack",
      ziwei_available: "derived from ziwei_fact_pack",
      authorized_partner_profile: "caller.authorized_partner_profile|false",
    },
  };
}
