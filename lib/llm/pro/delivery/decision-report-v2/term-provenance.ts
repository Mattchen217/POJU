/**
 * Term ID provenance for Face01 / BookJudgment units.
 *
 * Authority model:
 * - Model-declared term_ids / source_domain / source_version are DECLARATIONS only.
 * - Certified term_ids come ONLY from structured cites (hit:/cfp:) + real CFP/ZFP availability.
 * - SSOT membership alone never certifies a term.
 * - Never invent from natural-language claim/anchors or dump the full glossary.
 * - Legacy empty term_ids stay empty (no auto-fill).
 */

import type { BookJudgmentPack, BookJudgmentUnit } from "@/lib/llm/pro/delivery/book-judgment/schema";
import { pojuTermBySlug } from "@/lib/glossary/pojulife-terms";

/** CFP short keys → SSOT term_ids (only when that key was actually present in chart feed). */
export const CFP_KEY_TO_TERM_IDS: Readonly<Record<string, readonly string[]>> = {
  dayMaster: ["day_master"],
  yongJi: ["yong_shen", "favorable_element", "unfavorable_element"],
  dayunNow: ["decade"],
  shishenHit: [], // no accurate closed mapping without further structure
  pathTags: [],
  conflictAnchors: [],
};

/**
 * Accurate hit_id → SSOT slug map.
 * Only exact, intentional mappings — never a generic "pattern" fallback.
 * Hit ids from ZFP are usually content hashes; they certify a term only when
 * the hit_id itself is an SSOT slug (or listed here).
 */
export const HIT_ID_TO_TERM_IDS: Readonly<Record<string, readonly string[]>> = {
  // Intentionally sparse: add only verified hit_id → slug pairs.
};

export type PersonalSourceDomain =
  | "bazi"
  | "ziwei"
  | "science"
  | "convergence"
  | "unavailable";

export type TermProvenanceRecord = {
  /** Certified SSOT term_id; null when hit is real but has no accurate mapping. */
  term_id: string | null;
  /** Structured cite that justified this record (hit:… / cfp:…). */
  source_cite: string;
  source_domain: PersonalSourceDomain;
  /** Always a real pack hash when domain is bazi/ziwei. */
  source_version: string | null;
  /** Preserved hit level when cite is hit:<id>:<level>. */
  hit_level?: string | null;
  certification: "certified" | "hit_unmapped";
};

export type ProvenanceRejection = {
  kind: "declared_term" | "declared_domain" | "declared_version" | "hit" | "cfp";
  value: string;
  reason: string;
};

export type UnitTermProvenanceResult = {
  /** Program-certified term_ids only. */
  term_ids: string[];
  records: TermProvenanceRecord[];
  /** Program-certified domain (never model-authored). */
  source_domain: PersonalSourceDomain;
  /** Program-certified version hash (never model-authored). */
  source_version: string | null;
  /** Model declarations (audit only). */
  declared: {
    term_ids: string[];
    source_domain: string | null;
    source_version: string | null;
  };
  rejected: ProvenanceRejection[];
};

function uniq(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const t = id.trim();
    if (!t || seen.has(t)) continue;
    if (!pojuTermBySlug(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Extract structured hit:/cfp: cites only (not free-text classical names). */
export function extractStructuredCitesFromUnit(unit: BookJudgmentUnit): string[] {
  const blob = [unit.claim, ...(unit.anchors ?? [])].join("\n");
  const cites: string[] = [];
  for (const m of blob.matchAll(/\bhit:([a-z0-9_]+):([a-z0-9_]+)\b/gi)) {
    cites.push(`hit:${m[1]!.toLowerCase()}:${m[2]!.toLowerCase()}`);
  }
  for (const m of blob.matchAll(/\bcfp:([a-zA-Z_]+)\b/g)) {
    cites.push(`cfp:${m[1]}`);
  }
  return [...new Set(cites)];
}

function packAllowsHit(
  pack: BookJudgmentPack | null | undefined,
  hitId: string,
  level: string,
): boolean {
  if (!pack?.pattern_hits_used?.length) return false;
  const want = `hit:${hitId}:${level}`.toLowerCase();
  return pack.pattern_hits_used.some((h) => {
    const t = h.trim().toLowerCase();
    if (t === want) return true;
    // Allow hit:<id>:<level> prefix match when pack lists the same id+level.
    if (t.startsWith(`hit:${hitId}:`) && t.endsWith(`:${level}`)) return true;
    return false;
  });
}

/**
 * Resolve accurate SSOT term_ids for a pattern hit_id.
 * Returns [] when no accurate mapping exists (do NOT fall back to "pattern").
 */
export function resolveHitIdToTermIds(hitId: string): string[] {
  const id = hitId.trim().toLowerCase();
  if (!id) return [];
  const mapped = HIT_ID_TO_TERM_IDS[id];
  if (mapped?.length) {
    return uniq(mapped.filter((t) => Boolean(pojuTermBySlug(t))));
  }
  // Exact slug match only — hit_id must itself be the SSOT slug.
  if (pojuTermBySlug(id)) return [id];
  return [];
}

/**
 * Certify term_ids + domain + version for one unit from structured cites + real availability.
 * Model-declared fields are recorded then discarded as authority.
 */
export function resolveUnitTermProvenance(input: {
  unit: BookJudgmentUnit;
  pack: BookJudgmentPack | null | undefined;
  availableCfpKeys?: ReadonlySet<string>;
  bazi_available: boolean;
  ziwei_available: boolean;
  cfp_hash?: string | null;
  zfp_hash?: string | null;
}): UnitTermProvenanceResult {
  const unit = input.unit;
  const records: TermProvenanceRecord[] = [];
  const rejected: ProvenanceRejection[] = [];

  const declared_term_ids = [...(unit.term_ids ?? [])];
  const declared_source_domain = unit.source_domain?.trim() || null;
  const declared_source_version = unit.source_version?.trim() || null;

  // --- Track-based non-destiny domains (never traditional). ---
  if (unit.track === "science" || unit.track === "convergence") {
    const source_domain: PersonalSourceDomain =
      unit.track === "science" ? "science" : "convergence";
    // Model may declare personal domains on science units — reject as authority.
    if (
      declared_source_domain &&
      declared_source_domain !== source_domain &&
      (declared_source_domain === "bazi" || declared_source_domain === "ziwei")
    ) {
      rejected.push({
        kind: "declared_domain",
        value: declared_source_domain,
        reason: "science_or_convergence_cannot_use_personal_domain",
      });
    }
    for (const tid of declared_term_ids) {
      rejected.push({
        kind: "declared_term",
        value: tid,
        reason: "model_declared_term_not_certified_without_structured_cite",
      });
    }
    if (declared_source_version) {
      rejected.push({
        kind: "declared_version",
        value: declared_source_version,
        reason: "model_declared_version_ignored",
      });
    }
    return {
      term_ids: [],
      records: [],
      source_domain,
      source_version: null,
      declared: {
        term_ids: declared_term_ids,
        source_domain: declared_source_domain,
        source_version: declared_source_version,
      },
      rejected,
    };
  }

  // --- Destiny: certify only from structured cites. ---
  const cites = extractStructuredCitesFromUnit(unit);
  let sawHit = false;
  let sawCfp = false;

  for (const cite of cites) {
    if (cite.startsWith("hit:")) {
      const parts = cite.split(":");
      const hitId = parts[1] ?? "";
      const level = parts[2] ?? "";
      if (!hitId || !level) {
        rejected.push({
          kind: "hit",
          value: cite,
          reason: "malformed_hit_cite",
        });
        continue;
      }
      if (!packAllowsHit(input.pack, hitId, level)) {
        rejected.push({
          kind: "hit",
          value: cite,
          reason: "hit_not_in_pattern_hits_used",
        });
        continue;
      }
      if (!input.ziwei_available) {
        rejected.push({
          kind: "hit",
          value: cite,
          reason: "ziwei_domain_unavailable",
        });
        continue;
      }
      sawHit = true;
      const mapped = resolveHitIdToTermIds(hitId);
      if (mapped.length === 0) {
        records.push({
          term_id: null,
          source_cite: cite,
          source_domain: "ziwei",
          source_version: input.zfp_hash ?? null,
          hit_level: level,
          certification: "hit_unmapped",
        });
      } else {
        for (const termId of mapped) {
          records.push({
            term_id: termId,
            source_cite: cite,
            source_domain: "ziwei",
            source_version: input.zfp_hash ?? null,
            hit_level: level,
            certification: "certified",
          });
        }
      }
    } else if (cite.startsWith("cfp:")) {
      const key = cite.slice(4);
      if (input.availableCfpKeys && !input.availableCfpKeys.has(key)) {
        rejected.push({
          kind: "cfp",
          value: cite,
          reason: "cfp_key_not_in_chart_fact_pack",
        });
        continue;
      }
      if (!input.bazi_available) {
        rejected.push({
          kind: "cfp",
          value: cite,
          reason: "bazi_domain_unavailable",
        });
        continue;
      }
      const mapped = CFP_KEY_TO_TERM_IDS[key] ?? [];
      if (!mapped.length) {
        rejected.push({
          kind: "cfp",
          value: cite,
          reason: "cfp_key_has_no_accurate_term_mapping",
        });
        continue;
      }
      sawCfp = true;
      for (const termId of mapped) {
        if (!pojuTermBySlug(termId)) continue;
        records.push({
          term_id: termId,
          source_cite: cite,
          source_domain: "bazi",
          source_version: input.cfp_hash ?? null,
          certification: "certified",
        });
      }
    }
  }

  // Domain authority: structured cites only. Dual personal cites → unavailable.
  let source_domain: PersonalSourceDomain = "unavailable";
  if (sawHit && sawCfp) {
    source_domain = "unavailable";
    rejected.push({
      kind: "declared_domain",
      value: "bazi+ziwei",
      reason: "destiny_unit_cannot_carry_both_personal_domains",
    });
  } else if (sawHit && input.ziwei_available) {
    source_domain = "ziwei";
  } else if (sawCfp && input.bazi_available) {
    source_domain = "bazi";
  }

  // Model-declared domain: never authority; reject when it disagrees.
  if (declared_source_domain) {
    if (
      declared_source_domain !== source_domain &&
      !(source_domain === "unavailable" && declared_source_domain === "unavailable")
    ) {
      rejected.push({
        kind: "declared_domain",
        value: declared_source_domain,
        reason:
          source_domain === "unavailable"
            ? "model_domain_ignored_program_unavailable"
            : `model_domain_overridden_by_program:${source_domain}`,
      });
    }
  }

  // Model-declared version: never authority.
  const program_version =
    source_domain === "ziwei"
      ? input.zfp_hash ?? null
      : source_domain === "bazi"
        ? input.cfp_hash ?? null
        : null;
  if (declared_source_version) {
    if (declared_source_version !== program_version) {
      rejected.push({
        kind: "declared_version",
        value: declared_source_version,
        reason: program_version
          ? `model_version_overridden_by_program:${program_version}`
          : "model_version_ignored_no_program_hash",
      });
    }
  }

  // Model-declared terms: certify only if identical term already derived from cites.
  const certifiedFromCites = new Set(
    records
      .filter((r) => r.certification === "certified" && r.term_id)
      .map((r) => r.term_id as string),
  );
  for (const tid of declared_term_ids) {
    if (!pojuTermBySlug(tid)) {
      rejected.push({
        kind: "declared_term",
        value: tid,
        reason: "not_in_ssot",
      });
      continue;
    }
    if (!certifiedFromCites.has(tid)) {
      rejected.push({
        kind: "declared_term",
        value: tid,
        reason: "ssot_alone_insufficient_no_structured_cite",
      });
    }
    // If already certified via cite, declaration is redundant — no reject noise.
  }

  // Destiny unavailable → drop all personal terms / records.
  if (source_domain === "unavailable") {
    return {
      term_ids: [],
      records: [],
      source_domain: "unavailable",
      source_version: null,
      declared: {
        term_ids: declared_term_ids,
        source_domain: declared_source_domain,
        source_version: declared_source_version,
      },
      rejected,
    };
  }

  // Keep records for the certified domain only (hits keep unmapped records).
  const filtered = records.filter((r) => r.source_domain === source_domain);
  const term_ids = uniq(
    filtered
      .filter((r) => r.certification === "certified" && r.term_id)
      .map((r) => r.term_id as string),
  );

  return {
    term_ids,
    records: filtered,
    source_domain,
    source_version: program_version,
    declared: {
      term_ids: declared_term_ids,
      source_domain: declared_source_domain,
      source_version: declared_source_version,
    },
    rejected,
  };
}

/** Detect which CFP short keys appear as structured content in chart text. */
export function detectAvailableCfpKeys(chart_fact_pack?: string | null): Set<string> {
  const text = chart_fact_pack?.trim() ?? "";
  const keys = new Set<string>();
  if (!text) return keys;
  for (const key of Object.keys(CFP_KEY_TO_TERM_IDS)) {
    // Structured feed markers / JSON-ish keys — not keyword topicality of user prose.
    if (
      new RegExp(`"${key}"\\s*:`, "i").test(text) ||
      new RegExp(`\\b${key}\\b\\s*[:=]`, "i").test(text) ||
      text.includes(`cfp:${key}`)
    ) {
      keys.add(key);
    }
  }
  // dayMaster / yongJi often appear as Chinese labels in CFP dumps — allow when classical labels present with structure.
  if (/日主|dayMaster|day_master/i.test(text)) keys.add("dayMaster");
  if (/用神|喜神|忌神|yongJi/i.test(text)) keys.add("yongJi");
  if (/大运|dayunNow|decade/i.test(text)) keys.add("dayunNow");
  return keys;
}
