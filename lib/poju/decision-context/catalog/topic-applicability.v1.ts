/**
 * Topic Applicability Rules SSOT — version 1 (Phase 2 topic packs).
 * Runtime authority: this module only. Do not parse PHASE-2-TOPIC-APPLICABILITY.md at runtime.
 *
 * Phase 2 seed map (non-empty packs only):
 * - career → DIR-JOB-OFFER
 * - entrepreneurship → DIR-BIZ-MODEL
 * - relationship → DIR-REL-DYNAMICS
 * - relocation → DIR-LOCALE-MOVE
 * - education → DIR-EDU-PATH
 *
 * Multi-tag: union of packs; Chart may propose hypothesis only — never RealityFact / silent scope expansion.
 * User decline/skip is NOT automatic N/A (Session eval writer requires explicit confirmation).
 */

export const TOPIC_APPLICABILITY_CATALOG_VERSION = "1" as const;

/** Closed-set DIR N/A condition for topic-pack not-applicable markers. */
export const TOPIC_PACK_NA_CONDITION_CODE = "topic_pack_not_applicable" as const;

export type TopicApplicabilityRuleDefinition = {
  readonly rule_id: string;
  readonly topic_code: string;
  readonly target_dir_id: string;
  readonly catalog_version: typeof TOPIC_APPLICABILITY_CATALOG_VERSION;
  /**
   * Phase 2 constraints (documentation pins; not runtime Markdown).
   * - multi_tag_ok: session may carry multiple tags; each rule authorizes only its DIR
   * - no_silent_scope_expansion: mid-session tag add requires Blueprint bump (out of S9)
   * - chart_hypothesis_only: Chart must not substitute RealityFact or auto-seed N/A
   */
  readonly constraints: {
    readonly multi_tag_ok: true;
    readonly no_silent_scope_expansion: true;
    readonly chart_hypothesis_only: true;
  };
};

const RULE_CONSTRAINTS = {
  multi_tag_ok: true,
  no_silent_scope_expansion: true,
  chart_hypothesis_only: true,
} as const;

const RAW_RULES: TopicApplicabilityRuleDefinition[] = [
  {
    rule_id: "topic_rule.career.v1",
    topic_code: "career",
    target_dir_id: "DIR-JOB-OFFER",
    catalog_version: TOPIC_APPLICABILITY_CATALOG_VERSION,
    constraints: RULE_CONSTRAINTS,
  },
  {
    rule_id: "topic_rule.entrepreneurship.v1",
    topic_code: "entrepreneurship",
    target_dir_id: "DIR-BIZ-MODEL",
    catalog_version: TOPIC_APPLICABILITY_CATALOG_VERSION,
    constraints: RULE_CONSTRAINTS,
  },
  {
    rule_id: "topic_rule.relationship.v1",
    topic_code: "relationship",
    target_dir_id: "DIR-REL-DYNAMICS",
    catalog_version: TOPIC_APPLICABILITY_CATALOG_VERSION,
    constraints: RULE_CONSTRAINTS,
  },
  {
    rule_id: "topic_rule.relocation.v1",
    topic_code: "relocation",
    target_dir_id: "DIR-LOCALE-MOVE",
    catalog_version: TOPIC_APPLICABILITY_CATALOG_VERSION,
    constraints: RULE_CONSTRAINTS,
  },
  {
    rule_id: "topic_rule.education.v1",
    topic_code: "education",
    target_dir_id: "DIR-EDU-PATH",
    catalog_version: TOPIC_APPLICABILITY_CATALOG_VERSION,
    constraints: RULE_CONSTRAINTS,
  },
];

function deepFreezeRules(
  rules: TopicApplicabilityRuleDefinition[],
): readonly TopicApplicabilityRuleDefinition[] {
  for (const rule of rules) {
    Object.freeze(rule.constraints);
    Object.freeze(rule);
  }
  return Object.freeze(rules);
}

/** Deep-frozen production rules for topic catalog version "1". */
export const TOPIC_APPLICABILITY_V1_RULES: readonly TopicApplicabilityRuleDefinition[] =
  deepFreezeRules(RAW_RULES);
