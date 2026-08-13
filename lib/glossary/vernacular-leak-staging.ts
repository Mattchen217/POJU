/**
 * Staging denylist from leak feedback (before merging into BANNED_TERMS_ZH).
 *
 * Process:
 * - purity / audit hit → recordUserFacingLeakHit
 * - review → add term here (STAGED_BAN_ZH) so delivery-body-purity catches it
 * - frequency ≥ LEAK_PROMOTE_TO_MAPPING_THRESHOLD → promote to mapping SSOT row
 * - once in BANNED_TERMS_ZH or mapping SSOT, remove from staging (avoid dup)
 *
 * Keep this list small. Do not dump the full closed set here.
 */

/**
 * Extra bare terms to ban in user-visible delivery prose / chat lint.
 * Prefer length ≥ 2. Single-char wuxing never go here.
 */
export const STAGED_BAN_ZH = [
  // Seeded from expression-contract anti-examples + common chat leaks
  // (not yet every closed ten-god — those live in delivery-body-purity BASIS_JARGON).
  "湿土",
  "燥土",
  "杀印相生",
  "官印相生",
  "伤官见官",
] as const;

export type StagedBanZh = (typeof STAGED_BAN_ZH)[number];

/**
 * Human-reviewed mapping drafts waiting for SSOT §2.3 + code twin sync.
 * Empty until a promotion is approved.
 */
export type StagedMappingDraft = {
  /** Proposed vernacular-mapping-ssot id (snake_case). */
  id: string;
  engine_concept: string;
  user_facing_en: string;
  user_facing_zh: string;
  allowed_frame: string;
  never: string;
  trace: string;
  /** Leak terms that triggered this draft. */
  from_leaks: readonly string[];
};

export const STAGED_MAPPING_DRAFTS: readonly StagedMappingDraft[] = [];
