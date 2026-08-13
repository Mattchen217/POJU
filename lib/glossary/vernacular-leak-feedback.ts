/**
 * Leak → ban → mapping promotion feedback loop.
 *
 * Flow (product process, phase-isolated — never POJU_IDENTITY):
 * 1. purity / audit hits call `recordUserFacingLeakHit`
 * 2. term enters staging ban (`vernacular-leak-staging.ts`) after review
 * 3. same concept ≥ LEAK_PROMOTE_TO_MAPPING_THRESHOLD → draft mapping row in SSOT
 *
 * Docs: `.cursor/docs/全局用户可见表达契约-映射表-SSOT.md` §7
 */

export type LeakSource =
  | "delivery_purity"
  | "compliance_audit"
  | "mark_connective"
  | "manual"
  | "fixture";

export type LeakHitRecord = {
  term: string;
  label: string;
  source: LeakSource;
  where?: string;
  at: string;
};

/** Same normalized term this many times → suggest mapping-row promotion. */
export const LEAK_PROMOTE_TO_MAPPING_THRESHOLD = 3;

const RING_MAX = 200;

type GlobalLeakBuf = {
  __pojuVernacularLeakHits?: LeakHitRecord[];
};

function buf(): LeakHitRecord[] {
  const g = globalThis as unknown as GlobalLeakBuf;
  if (!g.__pojuVernacularLeakHits) g.__pojuVernacularLeakHits = [];
  return g.__pojuVernacularLeakHits;
}

/** Normalize for counting (trim; keep CJK as-is). */
export function normalizeLeakTerm(term: string): string {
  return (term ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Record a user-visible leak. Safe in serverless (ring buffer + console only).
 * Does not write the filesystem.
 */
export function recordUserFacingLeakHit(input: {
  term: string;
  label: string;
  source: LeakSource;
  where?: string;
  at?: string;
  /** Skip console (still buffers) — use when parent logger already warned. */
  quiet?: boolean;
}): LeakHitRecord | null {
  const term = normalizeLeakTerm(input.term);
  if (!term || term.length < 2) return null;
  const rec: LeakHitRecord = {
    term,
    label: input.label,
    source: input.source,
    where: input.where,
    at: input.at ?? new Date().toISOString(),
  };
  const hits = buf();
  hits.push(rec);
  if (hits.length > RING_MAX) hits.splice(0, hits.length - RING_MAX);
  if (!input.quiet) {
    console.warn("[vernacular-leak]", {
      term: rec.term,
      label: rec.label,
      source: rec.source,
      where: rec.where,
    });
  }
  return rec;
}

export function getLeakHitBuffer(): readonly LeakHitRecord[] {
  return [...buf()];
}

/** Test helper — clear process ring buffer. */
export function clearLeakHitBuffer(): void {
  const g = globalThis as unknown as GlobalLeakBuf;
  g.__pojuVernacularLeakHits = [];
}

export type LeakPromotionSuggestion = {
  /** Terms to add to staging / BANNED / purity extra lists. */
  banCandidates: Array<{ term: string; count: number }>;
  /** Terms seen often enough to deserve a vernacular mapping row. */
  mappingCandidates: Array<{ term: string; count: number }>;
};

export function aggregateLeakCounts(
  hits: readonly LeakHitRecord[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const h of hits) {
    const t = normalizeLeakTerm(h.term);
    if (!t) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return counts;
}

/**
 * From a batch of hits: every distinct term is a ban candidate;
 * counts ≥ threshold become mapping candidates.
 */
export function suggestLeakPromotions(
  hits: readonly LeakHitRecord[],
  threshold: number = LEAK_PROMOTE_TO_MAPPING_THRESHOLD,
): LeakPromotionSuggestion {
  const counts = aggregateLeakCounts(hits);
  const banCandidates = [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term, "zh"));
  const mappingCandidates = banCandidates.filter((x) => x.count >= threshold);
  return { banCandidates, mappingCandidates };
}

export function formatLeakPromotionReport(
  hits: readonly LeakHitRecord[],
  threshold: number = LEAK_PROMOTE_TO_MAPPING_THRESHOLD,
): string {
  const { banCandidates, mappingCandidates } = suggestLeakPromotions(
    hits,
    threshold,
  );
  const lines = [
    `# Vernacular leak promotion report`,
    `hits=${hits.length} threshold=${threshold}`,
    ``,
    `## Ban candidates (→ staging ban / purity / BANNED_TERMS review)`,
    ...(banCandidates.length
      ? banCandidates.map((x) => `- ${x.term} ×${x.count}`)
      : ["- (none)"]),
    ``,
    `## Mapping promotion candidates (≥${threshold} → SSOT §2.3 + vernacular-mapping-ssot.ts)`,
    ...(mappingCandidates.length
      ? mappingCandidates.map(
          (x) =>
            `- ${x.term} ×${x.count} — draft user_facing + allowed_frame + never + trace`,
        )
      : ["- (none)"]),
    ``,
    `## Checklist`,
    `1. Add new bans to lib/glossary/vernacular-leak-staging.ts (STAGED_BAN_ZH)`,
    `2. If mapping: edit .cursor/docs/全局用户可见表达契约-映射表-SSOT.md §2.3 then vernacular-mapping-ssot.ts`,
    `3. Wire mapping id into the right EXPRESSION_CONTRACT_MAPPING_IDS preset`,
    `4. NEVER inject mapping table into POJU_IDENTITY`,
    `5. Run pnpm test:expression-contract && pnpm test:delivery-lint-guard && pnpm test:leak-feedback`,
  ];
  return lines.join("\n");
}
