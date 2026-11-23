/**
 * Term ID provenance for Face01 / BookJudgment units.
 *
 * Rules:
 * - term_ids must come from explicit unit fields or structured cites (hit:/cfp:),
 *   never from natural-language guessing or full glossary dump.
 * - Only SSOT-resolvable term_ids are kept.
 * - Legacy units with empty term_ids stay empty.
 */

import type { BookJudgmentPack, BookJudgmentUnit } from "@/lib/llm/pro/delivery/book-judgment/schema";
import { pojuTermBySlug } from "@/lib/glossary/pojulife-terms";

/** CFP short keys → SSOT term_ids (only when that key was actually present in chart feed). */
export const CFP_KEY_TO_TERM_IDS: Readonly<Record<string, readonly string[]>> = {
  dayMaster: ["day_master"],
  yongJi: ["yong_shen", "favorable_element", "unfavorable_element"],
  dayunNow: ["decade"],
  shishenHit: [], // ten-god specifics require explicit unit.term_ids
  pathTags: [],
  conflictAnchors: [],
};

export type PersonalSourceDomain =
  | "bazi"
  | "ziwei"
  | "science"
  | "convergence"
  | "unavailable";

export type TermProvenanceRecord = {
  term_id: string;
  /** Structured cite that justified this term (hit:… / cfp:… / unit.term_ids). */
  source_cite: string;
  source_domain: PersonalSourceDomain;
  source_version: string | null;
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

function packAllowsHit(pack: BookJudgmentPack | null | undefined, hitId: string): boolean {
  if (!pack?.pattern_hits_used?.length) return false;
  return pack.pattern_hits_used.some((h) => {
    const t = h.trim().toLowerCase();
    return t === hitId || t.startsWith(`hit:${hitId}:`) || t.includes(`:${hitId}:`);
  });
}

/**
 * Resolve term_ids for one unit from explicit fields + structured cites.
 * `availableCfpKeys` limits which cfp: mappings are legal for this report.
 */
export function resolveUnitTermProvenance(input: {
  unit: BookJudgmentUnit;
  pack: BookJudgmentPack | null | undefined;
  availableCfpKeys?: ReadonlySet<string>;
  bazi_available: boolean;
  ziwei_available: boolean;
  cfp_hash?: string | null;
  zfp_hash?: string | null;
}): {
  term_ids: string[];
  records: TermProvenanceRecord[];
  source_domain: PersonalSourceDomain;
  source_version: string | null;
} {
  const unit = input.unit;
  const records: TermProvenanceRecord[] = [];

  const explicitDomain = unit.source_domain ?? null;
  const hadExplicitPersonalDomain =
    explicitDomain === "bazi" || explicitDomain === "ziwei";

  let source_domain: PersonalSourceDomain =
    explicitDomain ??
    (unit.track === "science"
      ? "science"
      : unit.track === "convergence"
        ? "convergence"
        : "unavailable");

  // Respect availability — never keep a domain that is not actually present.
  if (source_domain === "bazi" && !input.bazi_available) {
    source_domain = "unavailable";
  }
  if (source_domain === "ziwei" && !input.ziwei_available) {
    source_domain = "unavailable";
  }

  // Explicit domain was declared but clamped unavailable → stay unavailable.
  // Do not rematch to the other personal domain.
  const explicitDomainUnavailable =
    hadExplicitPersonalDomain && source_domain === "unavailable";

  // Explicit term_ids on unit (new packs) — still must be SSOT.
  // Keep the unit's declared domain on the record; availability filter drops later.
  for (const tid of unit.term_ids ?? []) {
    if (!pojuTermBySlug(tid)) continue;
    const recordDomain: PersonalSourceDomain = explicitDomainUnavailable
      ? "unavailable"
      : source_domain;
    records.push({
      term_id: tid,
      source_cite: `unit.term_ids:${tid}`,
      source_domain: recordDomain,
      source_version:
        unit.source_version?.trim() ||
        (recordDomain === "ziwei"
          ? input.zfp_hash ?? null
          : recordDomain === "bazi"
            ? input.cfp_hash ?? null
            : null),
    });
  }

  // Structured cites — not NLP.
  const cites = extractStructuredCitesFromUnit(unit);
  let sawHit = false;
  let sawCfp = false;
  for (const cite of cites) {
    if (cite.startsWith("hit:")) {
      const hitId = cite.split(":")[1] ?? "";
      if (!hitId || !packAllowsHit(input.pack, hitId)) continue;
      if (!input.ziwei_available) continue;
      // Explicit bazi unit must not absorb ziwei hit cites.
      if (explicitDomain === "bazi") continue;
      sawHit = true;
      const termId = pojuTermBySlug(hitId)
        ? hitId
        : pojuTermBySlug("pattern")
          ? "pattern"
          : null;
      if (!termId) continue;
      records.push({
        term_id: termId,
        source_cite: cite,
        source_domain: "ziwei",
        source_version: input.zfp_hash ?? null,
      });
    } else if (cite.startsWith("cfp:")) {
      const key = cite.slice(4);
      if (input.availableCfpKeys && !input.availableCfpKeys.has(key)) continue;
      if (!input.bazi_available) continue;
      // Explicit ziwei unit must not absorb bazi cfp cites.
      if (explicitDomain === "ziwei") continue;
      sawCfp = true;
      for (const termId of CFP_KEY_TO_TERM_IDS[key] ?? []) {
        if (!pojuTermBySlug(termId)) continue;
        records.push({
          term_id: termId,
          source_cite: cite,
          source_domain: "bazi",
          source_version: input.cfp_hash ?? null,
        });
      }
    }
  }

  if (
    unit.track === "destiny" &&
    source_domain === "unavailable" &&
    !explicitDomainUnavailable
  ) {
    // Infer only when the unit never declared a personal domain.
    if (sawHit && input.ziwei_available) source_domain = "ziwei";
    else if (sawCfp && input.bazi_available) source_domain = "bazi";
    else if (
      input.bazi_available &&
      !input.ziwei_available &&
      (sawCfp || (unit.term_ids?.length ?? 0) > 0)
    ) {
      // Single-domain pack + legacy unit without source_domain: allow bazi only
      // when there is an explicit term or cfp cite — never from track alone.
      source_domain = sawCfp ? "bazi" : "unavailable";
    } else if (
      input.ziwei_available &&
      !input.bazi_available &&
      (sawHit || (unit.term_ids?.length ?? 0) > 0)
    ) {
      source_domain = sawHit ? "ziwei" : "unavailable";
    }
    // Both available with no structured cite / explicit domain → stay unavailable.
  }

  // Drop personal terms when domain unavailable, or when record domain mismatches.
  const filtered =
    source_domain === "unavailable" && unit.track === "destiny"
      ? []
      : records.filter((r) => {
          if (r.source_domain === "unavailable") return false;
          if (r.source_domain === "bazi" && !input.bazi_available) return false;
          if (r.source_domain === "ziwei" && !input.ziwei_available) return false;
          // One unit → one personal domain.
          if (
            (source_domain === "bazi" || source_domain === "ziwei") &&
            (r.source_domain === "bazi" || r.source_domain === "ziwei") &&
            r.source_domain !== source_domain
          ) {
            return false;
          }
          return true;
        });

  const term_ids = uniq(filtered.map((r) => r.term_id));
  const source_version =
    unit.source_version?.trim() ||
    (source_domain === "ziwei"
      ? input.zfp_hash ?? null
      : source_domain === "bazi"
        ? input.cfp_hash ?? null
        : null);

  return {
    term_ids,
    records: filtered.filter((r) => term_ids.includes(r.term_id)),
    source_domain,
    source_version,
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
