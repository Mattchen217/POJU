/**
 * Unit A / R2 — DI2 → Batch 2 input adapter (mapping only).
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
 *
 * Trust boundary (Unit C wiring precondition — not enforced by shape alone):
 * Structure-valid ZFP ≠ trusted ZFP. Unit C MUST pass a ZiweiFactPack produced
 * by server-trusted computation/verification for the current Freeze/Profile
 * identity. A caller-submitted object that merely passes
 * assertZiweiFactPackStructure is not sufficient provenance.
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
import { ZIWEI_RUNTIME_PALACES } from "@/lib/ziwei/token-disposition";

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
   *
   * Unit C: must originate from server-trusted compute/verify for this
   * Freeze/Profile — structural validity here does not prove provenance.
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

const MUTAGEN_SET = new Set(["禄", "权", "科", "忌"]);
const PATTERN_LEVEL_SET = new Set(["excellent", "good", "neutral", "caution"]);
const LIBRARY_SET = new Set(["ziwei-doushu", "iztro"]);
const GENDER_SET = new Set(["男", "女"]);
const CLOCK_SET = new Set(["tst_meta", "true_solar", "civil"]);
const PALACE_NAME_SET = new Set<string>(ZIWEI_RUNTIME_PALACES);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isOptionalStringArray(v: unknown): boolean {
  return v === undefined || isStringArray(v);
}

function assertSihuaHit(
  v: unknown,
  path: string,
): string | null {
  if (!isPlainObject(v)) return `${path} must be an object`;
  if (!MUTAGEN_SET.has(v.mutagen as string)) {
    return `${path}.mutagen must be one of 禄|权|科|忌`;
  }
  if (typeof v.star !== "string") return `${path}.star must be string`;
  if (typeof v.palace !== "string") return `${path}.palace must be string`;
  return null;
}

function assertSihuaArray(v: unknown, path: string): string | null {
  if (!Array.isArray(v)) return `${path} must be an array`;
  for (const [i, hit] of v.entries()) {
    const err = assertSihuaHit(hit, `${path}[${i}]`);
    if (err) return err;
  }
  return null;
}

function assertPatternHit(v: unknown, path: string): string | null {
  if (!isPlainObject(v)) return `${path} must be an object`;
  if (typeof v.name !== "string") return `${path}.name must be string`;
  if (!PATTERN_LEVEL_SET.has(v.level as string)) {
    return `${path}.level must be excellent|good|neutral|caution`;
  }
  if (!isStringArray(v.palaces)) return `${path}.palaces must be string[]`;
  if (!isOptionalStringArray(v.required)) {
    return `${path}.required must be string[] when present`;
  }
  if (!isOptionalStringArray(v.bonus)) {
    return `${path}.bonus must be string[] when present`;
  }
  if (!isOptionalStringArray(v.breaking)) {
    return `${path}.breaking must be string[] when present`;
  }
  if (v.source !== undefined && typeof v.source !== "string") {
    return `${path}.source must be string when present`;
  }
  return null;
}

/**
 * Runtime structural gate for ZiweiFactPack aligned to lib/ziwei/fact-pack.ts.
 * Validates nested types, enums, finite numbers, and full 12-palace set.
 * Does NOT prove provenance / Freeze binding — see trust boundary above.
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
  if (topic.role !== "ming") {
    return { ok: false, detail: 'topicPalace.role must be "ming"' };
  }
  for (const key of [
    "palace",
    "heavenlyStem",
    "earthlyBranch",
    "oppositePalace",
  ] as const) {
    if (typeof topic[key] !== "string") {
      return { ok: false, detail: `topicPalace.${key} must be string` };
    }
  }
  if (!isStringArray(topic.majorStars)) {
    return { ok: false, detail: "topicPalace.majorStars must be string[]" };
  }
  if (!isStringArray(topic.oppositeMajorStars)) {
    return {
      ok: false,
      detail: "topicPalace.oppositeMajorStars must be string[]",
    };
  }

  const sihuaErr = assertSihuaArray(raw.sihua, "sihua");
  if (sihuaErr) return { ok: false, detail: sihuaErr };

  const daxian = raw.daxian;
  if (!isPlainObject(daxian)) {
    return { ok: false, detail: "daxian must be an object" };
  }
  for (const key of ["palace", "heavenlyStem", "earthlyBranch"] as const) {
    if (typeof daxian[key] !== "string") {
      return { ok: false, detail: `daxian.${key} must be string` };
    }
  }
  if (!isFiniteNumber(daxian.startAge) || !isFiniteNumber(daxian.endAge)) {
    return {
      ok: false,
      detail: "daxian.startAge/endAge must be finite numbers",
    };
  }
  if (daxian.startAge > daxian.endAge) {
    return { ok: false, detail: "daxian.startAge must be <= endAge" };
  }
  if (!isStringArray(daxian.majorStars)) {
    return { ok: false, detail: "daxian.majorStars must be string[]" };
  }
  const daxianSihuaErr = assertSihuaArray(daxian.sihua, "daxian.sihua");
  if (daxianSihuaErr) return { ok: false, detail: daxianSihuaErr };

  const liunian = daxian.liunian;
  if (!isPlainObject(liunian)) {
    return { ok: false, detail: "daxian.liunian must be an object" };
  }
  if (!isFiniteNumber(liunian.year)) {
    return { ok: false, detail: "daxian.liunian.year must be a finite number" };
  }
  for (const key of ["heavenlyStem", "earthlyBranch", "palace"] as const) {
    if (typeof liunian[key] !== "string") {
      return { ok: false, detail: `daxian.liunian.${key} must be string` };
    }
  }
  const liunianSihuaErr = assertSihuaArray(liunian.sihua, "daxian.liunian.sihua");
  if (liunianSihuaErr) return { ok: false, detail: liunianSihuaErr };

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
  for (const [i, hit] of raw.patternHits.entries()) {
    const err = assertPatternHit(hit, `patternHits[${i}]`);
    if (err) return { ok: false, detail: err };
  }

  if (!Array.isArray(raw.palaces)) {
    return { ok: false, detail: "palaces must be an array" };
  }
  if (raw.palaces.length !== ZIWEI_RUNTIME_PALACES.length) {
    return {
      ok: false,
      detail: `palaces must contain exactly ${ZIWEI_RUNTIME_PALACES.length} entries (十二宫)`,
    };
  }
  const seenNames = new Set<string>();
  for (const [i, p] of raw.palaces.entries()) {
    if (!isPlainObject(p)) {
      return { ok: false, detail: `palaces[${i}] must be an object` };
    }
    if (typeof p.name !== "string" || !PALACE_NAME_SET.has(p.name)) {
      return {
        ok: false,
        detail: `palaces[${i}].name must be a known runtime palace`,
      };
    }
    if (seenNames.has(p.name)) {
      return { ok: false, detail: `palaces duplicate name: ${p.name}` };
    }
    seenNames.add(p.name);
    if (typeof p.heavenlyStem !== "string") {
      return { ok: false, detail: `palaces[${i}].heavenlyStem must be string` };
    }
    if (typeof p.earthlyBranch !== "string") {
      return { ok: false, detail: `palaces[${i}].earthlyBranch must be string` };
    }
    if (!isStringArray(p.majorStars)) {
      return { ok: false, detail: `palaces[${i}].majorStars must be string[]` };
    }
    if (typeof p.isBodyPalace !== "boolean") {
      return { ok: false, detail: `palaces[${i}].isBodyPalace must be boolean` };
    }
    if (
      !Array.isArray(p.decadalRange) ||
      p.decadalRange.length !== 2 ||
      !isFiniteNumber(p.decadalRange[0]) ||
      !isFiniteNumber(p.decadalRange[1])
    ) {
      return {
        ok: false,
        detail: `palaces[${i}].decadalRange must be [finite, finite]`,
      };
    }
  }
  for (const expected of ZIWEI_RUNTIME_PALACES) {
    if (!seenNames.has(expected)) {
      return { ok: false, detail: `palaces missing required palace: ${expected}` };
    }
  }

  const source = raw.source;
  if (!isPlainObject(source)) {
    return { ok: false, detail: "source must be an object" };
  }
  if (!LIBRARY_SET.has(source.library as string)) {
    return { ok: false, detail: 'source.library must be "ziwei-doushu"|"iztro"' };
  }
  if (typeof source.version !== "string") {
    return { ok: false, detail: "source.version must be string" };
  }
  if (source.license !== "MIT") {
    return { ok: false, detail: 'source.license must be "MIT"' };
  }
  if (typeof source.solarDate !== "string") {
    return { ok: false, detail: "source.solarDate must be string" };
  }
  if (!isFiniteNumber(source.timeIndex)) {
    return { ok: false, detail: "source.timeIndex must be a finite number" };
  }
  if (
    !Number.isInteger(source.timeIndex) ||
    source.timeIndex < 0 ||
    source.timeIndex > 12
  ) {
    return { ok: false, detail: "source.timeIndex must be an integer 0..12" };
  }
  if (!GENDER_SET.has(source.gender as string)) {
    return { ok: false, detail: 'source.gender must be "男"|"女"' };
  }
  if (source.fixLeap !== true) {
    return { ok: false, detail: "source.fixLeap must be true" };
  }
  if (!CLOCK_SET.has(source.clock as string)) {
    return {
      ok: false,
      detail: 'source.clock must be "tst_meta"|"true_solar"|"civil"',
    };
  }
  if (typeof source.asOf !== "string") {
    return { ok: false, detail: "source.asOf must be string" };
  }
  if (
    source.chart_engine !== undefined &&
    source.chart_engine !== "iztro"
  ) {
    return { ok: false, detail: 'source.chart_engine must be "iztro" when present' };
  }
  if (
    source.patterns_commit !== undefined &&
    typeof source.patterns_commit !== "string"
  ) {
    return {
      ok: false,
      detail: "source.patterns_commit must be string when present",
    };
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
