/**
 * Unit A / R1 — DI2 → Batch 2 input adapter (mapping only).
 *
 * Receives already-verified Freeze / Profile / optional packs and produces
 * ReportBatch2JobInputs. Does not authorize, create jobs, lock sessions,
 * charge, dispatch orchestrators, or call models.
 *
 * Schema gaps (documented, not invented):
 * - BookJudgmentPack ≠ ProfileRecord. Pack is only accepted when the caller
 *   supplies a schema-valid pack; Profile is never cast to BookJudgmentPack.
 * - ProfileRecord stores ziwei_closed_set (prompt text) + ziwei_status, not a
 *   structured ZiweiFactPack, and does not retain raw birth. When Ziwei was
 *   successfully computed (ziwei_status=ok or closed_set present), the caller
 *   MUST supply a structurally valid ZiweiFactPack — we refuse to silently
 *   drop computed Ziwei by reporting ziwei_available=false.
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
   * Structured ZiweiFactPack. Required when Profile indicates Ziwei was
   * computed successfully; optional when ziwei_status is not_available/failed
   * and ziwei_closed_set is empty.
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
  | "profile_day_master_missing"
  | "chart_fact_pack_build_failed"
  | "ziwei_fact_pack_invalid"
  | "ziwei_structured_pack_required";

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
  chart_fact_pack: "buildChartFactPack(profile.chart_structure)";
  ziwei_fact_pack:
    | "caller.ziwei_fact_pack"
    | "absent→null (ziwei not computed on Profile)";
  report_id: "identity.report_job_id";
  bazi_available: "derived from chart_fact_pack";
  ziwei_available: "derived from ziwei_fact_pack";
  authorized_partner_profile: "caller.authorized_partner_profile|false";
};

function nonEmpty(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isSihuaHit(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  return (
    typeof v.mutagen === "string" &&
    typeof v.star === "string" &&
    typeof v.palace === "string"
  );
}

/**
 * Runtime structural gate for ZiweiFactPack.
 * Not a Zod schema (none exists in-repo); checks required keys + nested shape
 * so `{ version: 1 }` and partial objects cannot mark ziwei_available=true.
 */
export function assertZiweiFactPackStructure(
  raw: unknown,
): { ok: true; pack: ZiweiFactPack } | { ok: false; detail: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, detail: "ziwei_fact_pack must be a non-null object" };
  }

  const requiredTop = [
    "topicPalace",
    "sihua",
    "daxian",
    "mingShen",
    "otherChart",
    "patternHits",
    "palaces",
    "source",
  ] as const;
  for (const key of requiredTop) {
    if (!(key in raw)) {
      return { ok: false, detail: `missing required field: ${key}` };
    }
  }

  if (raw.otherChart !== null) {
    return { ok: false, detail: "otherChart must be null" };
  }

  const topic = raw.topicPalace;
  if (!isPlainObject(topic)) {
    return { ok: false, detail: "topicPalace must be an object" };
  }
  for (const key of [
    "role",
    "palace",
    "heavenlyStem",
    "earthlyBranch",
    "majorStars",
    "oppositePalace",
    "oppositeMajorStars",
  ] as const) {
    if (!(key in topic)) {
      return { ok: false, detail: `topicPalace missing ${key}` };
    }
  }
  if (topic.role !== "ming") {
    return { ok: false, detail: 'topicPalace.role must be "ming"' };
  }
  if (!isStringArray(topic.majorStars) || !isStringArray(topic.oppositeMajorStars)) {
    return { ok: false, detail: "topicPalace star lists must be string[]" };
  }

  if (!Array.isArray(raw.sihua) || !raw.sihua.every(isSihuaHit)) {
    return { ok: false, detail: "sihua must be an array of {mutagen,star,palace}" };
  }

  const daxian = raw.daxian;
  if (!isPlainObject(daxian)) {
    return { ok: false, detail: "daxian must be an object" };
  }
  for (const key of [
    "palace",
    "heavenlyStem",
    "earthlyBranch",
    "startAge",
    "endAge",
    "majorStars",
    "sihua",
    "liunian",
  ] as const) {
    if (!(key in daxian)) {
      return { ok: false, detail: `daxian missing ${key}` };
    }
  }
  if (typeof daxian.startAge !== "number" || typeof daxian.endAge !== "number") {
    return { ok: false, detail: "daxian ages must be numbers" };
  }
  if (!isStringArray(daxian.majorStars) || !Array.isArray(daxian.sihua) || !daxian.sihua.every(isSihuaHit)) {
    return { ok: false, detail: "daxian.majorStars/sihua shape invalid" };
  }
  const liunian = daxian.liunian;
  if (!isPlainObject(liunian)) {
    return { ok: false, detail: "daxian.liunian must be an object" };
  }
  for (const key of [
    "year",
    "heavenlyStem",
    "earthlyBranch",
    "palace",
    "sihua",
  ] as const) {
    if (!(key in liunian)) {
      return { ok: false, detail: `daxian.liunian missing ${key}` };
    }
  }
  if (typeof liunian.year !== "number" || !Array.isArray(liunian.sihua) || !liunian.sihua.every(isSihuaHit)) {
    return { ok: false, detail: "daxian.liunian shape invalid" };
  }

  const mingShen = raw.mingShen;
  if (!isPlainObject(mingShen)) {
    return { ok: false, detail: "mingShen must be an object" };
  }
  for (const key of [
    "soul",
    "body",
    "mingBranch",
    "shenBranch",
    "shenPalace",
    "fiveElementsClass",
  ] as const) {
    if (typeof mingShen[key] !== "string") {
      return { ok: false, detail: `mingShen.${key} must be string` };
    }
  }

  if (!Array.isArray(raw.patternHits)) {
    return { ok: false, detail: "patternHits must be an array" };
  }

  if (!Array.isArray(raw.palaces) || raw.palaces.length === 0) {
    return { ok: false, detail: "palaces must be a non-empty array" };
  }
  for (const [i, p] of raw.palaces.entries()) {
    if (!isPlainObject(p)) {
      return { ok: false, detail: `palaces[${i}] must be an object` };
    }
    if (
      typeof p.name !== "string" ||
      typeof p.heavenlyStem !== "string" ||
      typeof p.earthlyBranch !== "string" ||
      !isStringArray(p.majorStars) ||
      typeof p.isBodyPalace !== "boolean" ||
      !Array.isArray(p.decadalRange) ||
      p.decadalRange.length !== 2 ||
      typeof p.decadalRange[0] !== "number" ||
      typeof p.decadalRange[1] !== "number"
    ) {
      return { ok: false, detail: `palaces[${i}] shape invalid` };
    }
  }

  const source = raw.source;
  if (!isPlainObject(source)) {
    return { ok: false, detail: "source must be an object" };
  }
  for (const key of [
    "library",
    "version",
    "license",
    "solarDate",
    "timeIndex",
    "gender",
    "fixLeap",
    "clock",
    "asOf",
  ] as const) {
    if (!(key in source)) {
      return { ok: false, detail: `source missing ${key}` };
    }
  }
  if (typeof source.version !== "string" || typeof source.solarDate !== "string") {
    return { ok: false, detail: "source.version/solarDate must be strings" };
  }
  if (typeof source.timeIndex !== "number") {
    return { ok: false, detail: "source.timeIndex must be a number" };
  }
  if (source.fixLeap !== true) {
    return { ok: false, detail: "source.fixLeap must be true" };
  }

  return { ok: true, pack: raw as ZiweiFactPack };
}

/** True when Profile indicates Ziwei was successfully computed (must not be dropped). */
export function profileIndicatesComputedZiwei(profile: ProfileRecord): boolean {
  if (profile.source?.ziwei_status === "ok") return true;
  if (nonEmpty(profile.ziwei_closed_set)) return true;
  return false;
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
      chart_fact_pack: string;
      provenance: Di2Batch2FieldProvenance["chart_fact_pack"];
    }
  | { ok: false; code: Di2Batch2AdapterErrorCode; detail: string } {
  const structured = profile.chart_structure;
  // Server Profile computation already requires day_master; absence here is
  // corrupt / non-contract Profile — never treat as optional Bazi unavailability.
  if (!structured?.day_master?.trim()) {
    return {
      ok: false,
      code: "profile_day_master_missing",
      detail:
        "verified DI2 Profile must include chart_structure.day_master (server compute contract)",
    };
  }
  try {
    const built = buildChartFactPack(structured, {
      as_of: new Date(profile.calculation_timestamp),
    });
    const text = built.text?.trim() ?? "";
    if (!text) {
      return {
        ok: false,
        code: "chart_fact_pack_build_failed",
        detail: "buildChartFactPack returned empty text for Profile with day_master",
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
  profile: ProfileRecord,
  raw: ZiweiFactPack | null | undefined,
):
  | {
      ok: true;
      ziwei_fact_pack: ZiweiFactPack | null;
      provenance: Di2Batch2FieldProvenance["ziwei_fact_pack"];
    }
  | { ok: false; code: Di2Batch2AdapterErrorCode; detail: string } {
  const computed = profileIndicatesComputedZiwei(profile);

  if (raw == null) {
    if (computed) {
      return {
        ok: false,
        code: "ziwei_structured_pack_required",
        detail:
          "Profile indicates computed Ziwei (ziwei_status=ok and/or ziwei_closed_set) " +
          "but no structurally valid ZiweiFactPack was supplied. " +
          "ProfileRecord does not store structured ZFP or raw birth — " +
          "refusing to silently drop computed Ziwei as unavailable.",
      };
    }
    return {
      ok: true,
      ziwei_fact_pack: null,
      provenance: "absent→null (ziwei not computed on Profile)",
    };
  }

  const checked = assertZiweiFactPackStructure(raw);
  if (!checked.ok) {
    return {
      ok: false,
      code: "ziwei_fact_pack_invalid",
      detail: checked.detail,
    };
  }
  return {
    ok: true,
    ziwei_fact_pack: checked.pack,
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

  const ziweiRes = resolveZiweiFactPack(source.profile, source.ziwei_fact_pack);
  if (!ziweiRes.ok) return ziweiRes;

  const authorized = source.authorized_partner_profile === true;

  const inputs: ReportBatch2JobInputs = {
    dc,
    pack: packRes.pack,
    chart_fact_pack: chartRes.chart_fact_pack,
    ziwei_fact_pack: ziweiRes.ziwei_fact_pack,
    report_id: identity.report_job_id.trim(),
    bazi_available: true,
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
