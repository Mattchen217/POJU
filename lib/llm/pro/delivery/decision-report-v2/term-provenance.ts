/**
 * Term ID provenance for Face01 / BookJudgment units.
 *
 * Authority model:
 * - Model-declared term_ids / source_domain / source_version / pattern_hits_used
 *   are DECLARATIONS only.
 * - Certified term_ids come ONLY from structured cites (hit:/cfp:) + real CFP/ZFP.
 * - ZFP hit authority = canonical refs from real ziwei.patternHits (never pack.pattern_hits_used).
 * - SSOT membership alone never certifies a term.
 * - Never invent from natural-language claim/anchors or dump the full glossary.
 */

import type { BookJudgmentPack, BookJudgmentUnit } from "@/lib/llm/pro/delivery/book-judgment/schema";
import { pojuTermBySlug } from "@/lib/glossary/pojulife-terms";
import { patternHitRefsForPrompt } from "@/lib/ziwei/soft-zfp-labels";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";

/** CFP short keys → SSOT term_ids (only when that key was actually present in chart feed). */
export const CFP_KEY_TO_TERM_IDS: Readonly<Record<string, readonly string[]>> = {
  dayMaster: ["day_master"],
  yongJi: ["yong_shen", "favorable_element", "unfavorable_element"],
  dayunNow: ["decade"],
  shishenHit: [],
  pathTags: [],
  conflictAnchors: [],
};

/**
 * Accurate hit_id → SSOT slug map.
 * Only exact, intentional mappings — never a generic "pattern" fallback.
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
  term_id: string | null;
  source_cite: string;
  source_domain: PersonalSourceDomain;
  source_version: string | null;
  hit_level?: string | null;
  certification: "certified" | "hit_unmapped";
};

export type ProvenanceRejection = {
  kind:
    | "declared_term"
    | "declared_domain"
    | "declared_version"
    | "hit"
    | "cfp"
    | "declared_pattern_hit";
  value: string;
  reason: string;
};

export type UnitTermProvenanceResult = {
  term_ids: string[];
  records: TermProvenanceRecord[];
  source_domain: PersonalSourceDomain;
  source_version: string | null;
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

/** Normalize a hit ref to lowercase canonical form; null if malformed. */
export function normalizeHitRef(raw: string): string | null {
  const m = /^hit:([a-z0-9_]+):([a-z0-9_]+)$/i.exec(raw.trim());
  if (!m) return null;
  return `hit:${m[1]!.toLowerCase()}:${m[2]!.toLowerCase()}`;
}

/**
 * Canonical hit refs from real ZFP patternHits — the ONLY trusted hit allowlist.
 * Never derived from model pattern_hits_used.
 */
export function canonicalPatternHitRefsFromZiwei(
  ziwei: ZiweiFactPack | null | undefined,
): string[] {
  if (!ziwei?.patternHits?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const ref of patternHitRefsForPrompt(ziwei.patternHits)) {
    const n = normalizeHitRef(ref);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function canonicalPatternHitRefSet(
  ziwei: ZiweiFactPack | null | undefined,
): ReadonlySet<string> {
  return new Set(canonicalPatternHitRefsFromZiwei(ziwei));
}

/**
 * Strict full-ref membership — no prefix/suffix/partial match.
 */
export function hitRefInAllowlist(
  hitId: string,
  level: string,
  allowlist: ReadonlySet<string> | null | undefined,
): boolean {
  if (!allowlist || allowlist.size === 0) return false;
  const want = normalizeHitRef(`hit:${hitId}:${level}`);
  if (!want) return false;
  return allowlist.has(want);
}

/** Extract structured hit:/cfp: cites from claim + anchors. */
export function extractStructuredCitesFromUnit(unit: BookJudgmentUnit): string[] {
  const blob = [unit.claim, ...(unit.anchors ?? [])].join("\n");
  return extractStructuredCitesFromText(blob);
}

/** Hit cites that appear in unit.claim only (for pattern_hits_used certification). */
export function extractStructuredHitCitesFromClaim(unit: BookJudgmentUnit): string[] {
  return extractStructuredCitesFromText(unit.claim).filter((c) =>
    c.startsWith("hit:"),
  );
}

function extractStructuredCitesFromText(blob: string): string[] {
  const cites: string[] = [];
  for (const m of blob.matchAll(/\bhit:([a-z0-9_]+):([a-z0-9_]+)\b/gi)) {
    const n = normalizeHitRef(`hit:${m[1]}:${m[2]}`);
    if (n) cites.push(n);
  }
  for (const m of blob.matchAll(/\bcfp:([a-zA-Z_]+)\b/g)) {
    cites.push(`cfp:${m[1]}`);
  }
  return [...new Set(cites)];
}

/**
 * Certify pack-level pattern_hits_used against real ZFP allowlist + unit.claim usage.
 * Model declarations are audited; fakes never enter the certified list.
 */
export function certifyPatternHitsUsed(input: {
  declared: readonly string[];
  units: readonly BookJudgmentUnit[];
  canonical_refs: readonly string[];
}): {
  pattern_hits_used: string[];
  declared_pattern_hits_used: string[];
  rejected: ProvenanceRejection[];
} {
  const canonical = new Set(
    input.canonical_refs
      .map((r) => normalizeHitRef(r))
      .filter((r): r is string => Boolean(r)),
  );
  const declared_pattern_hits_used = [
    ...new Set(
      input.declared
        .map((r) => normalizeHitRef(r) ?? r.trim())
        .filter(Boolean),
    ),
  ];
  const rejected: ProvenanceRejection[] = [];

  for (const d of declared_pattern_hits_used) {
    const n = normalizeHitRef(d);
    if (!n) {
      rejected.push({
        kind: "declared_pattern_hit",
        value: d,
        reason: "malformed_hit_ref",
      });
      continue;
    }
    if (!canonical.has(n)) {
      rejected.push({
        kind: "declared_pattern_hit",
        value: n,
        reason: "hit_not_in_real_zfp_allowlist",
      });
    }
  }

  // Used in claim ∩ canonical (model declaration not required to keep a real used hit).
  const used = new Set<string>();
  for (const unit of input.units) {
    for (const cite of extractStructuredHitCitesFromClaim(unit)) {
      if (canonical.has(cite)) used.add(cite);
    }
  }

  const pattern_hits_used = [...used];
  return { pattern_hits_used, declared_pattern_hits_used, rejected };
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
  if (pojuTermBySlug(id)) return [id];
  return [];
}

/**
 * Certify term_ids + domain + version for one unit from structured cites + real availability.
 * Hit authority = actual_pattern_hit_refs (real ZFP), never pack.pattern_hits_used.
 */
export function resolveUnitTermProvenance(input: {
  unit: BookJudgmentUnit;
  pack?: BookJudgmentPack | null | undefined;
  /** Canonical refs from real ziwei.patternHits — required for hit certification. */
  actual_pattern_hit_refs?: ReadonlySet<string> | readonly string[] | null;
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

  const hitAllowlist: ReadonlySet<string> = (() => {
    if (input.actual_pattern_hit_refs instanceof Set) {
      return input.actual_pattern_hit_refs;
    }
    if (Array.isArray(input.actual_pattern_hit_refs)) {
      return new Set(
        input.actual_pattern_hit_refs
          .map((r) => normalizeHitRef(r))
          .filter((r): r is string => Boolean(r)),
      );
    }
    // No real ZFP allowlist provided → empty (do NOT fall back to pack.pattern_hits_used).
    return new Set();
  })();

  if (unit.track === "science" || unit.track === "convergence") {
    const source_domain: PersonalSourceDomain =
      unit.track === "science" ? "science" : "convergence";
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

  const cites = extractStructuredCitesFromUnit(unit);
  let sawHit = false;
  let sawCfp = false;

  for (const cite of cites) {
    if (cite.startsWith("hit:")) {
      const parts = cite.split(":");
      const hitId = parts[1] ?? "";
      const level = parts[2] ?? "";
      if (!hitId || !level || parts.length !== 3) {
        rejected.push({
          kind: "hit",
          value: cite,
          reason: "malformed_hit_cite",
        });
        continue;
      }
      // Strict full-ref match against real ZFP allowlist only.
      if (!hitRefInAllowlist(hitId, level, hitAllowlist)) {
        rejected.push({
          kind: "hit",
          value: cite,
          reason: "hit_not_in_real_zfp_allowlist",
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
  }

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
    if (
      new RegExp(`"${key}"\\s*:`, "i").test(text) ||
      new RegExp(`\\b${key}\\b\\s*[:=]`, "i").test(text) ||
      text.includes(`cfp:${key}`)
    ) {
      keys.add(key);
    }
  }
  if (/日主|dayMaster|day_master/i.test(text)) keys.add("dayMaster");
  if (/用神|喜神|忌神|yongJi/i.test(text)) keys.add("yongJi");
  if (/大运|dayunNow|decade/i.test(text)) keys.add("dayunNow");
  return keys;
}
