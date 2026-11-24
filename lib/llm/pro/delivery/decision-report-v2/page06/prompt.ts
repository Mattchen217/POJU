/**
 * Face06 prompt pair — production path injects architecture bundle + full payload.
 */

export type Face06ProductionPayload = {
  decision_question: string;
  locale: string;
  page01: unknown;
  page02: {
    present: boolean;
    content_units: unknown[] | null;
    explanation_boundary: unknown | null;
  };
  page04: {
    present: boolean;
    content_units: unknown[] | null;
    evidence_boundary: unknown | null;
  };
  page05: {
    present: boolean;
    preferred_path_ids: string[];
    alternative_path_ids: string[];
    cautious_path_ids: string[];
    all_path_ids: string[];
    path_units: unknown[] | null;
    path_comparison: { rows: unknown[] } | null;
    switching_rules: unknown[] | null;
  };
  reality: {
    confirmed_facts: unknown[];
    unverified_facts: unknown[];
    declined_or_unknown_facts: unknown[];
    open_conflicts: unknown[];
    constraints: unknown[];
    dirs: unknown[];
  };
  book_judgment_face06_units: unknown[];
  personal_readings: Array<{
    reading_id: string;
    domain: string;
    excerpt: string;
  }>;
  registry: {
    claims: unknown[];
    evidence: unknown[];
  };
  input_manifest: unknown[];
  missing_inputs: unknown[];
};

export function buildFace06PromptPair(input: {
  locale: string;
  architecture_prompt_bundle: string;
  production_payload: Face06ProductionPayload;
}): { system: string; user: string } {
  const system = [
    "You are POJU Page06 Strategy Execution & Validation writer.",
    "Output ONE JSON object matching Face06V2 schema only — no markdown fences.",
    "Page06 duty: execute paths Page05 already chose. primary_path_id is a preferred path; fallback_path_ids are alternatives.",
    "Write a first step, ordered execution actions, optional validation experiments, personal adjustments, phase rhythm, resource boundaries, and a monitoring contract.",
    "Do NOT invent path_ids. Do NOT restate Page05 comparison or Page01 conclusion as the body.",
    "page05.path_comparison is Page05's already-decided strategy boundary (cost/risk/resources/reversibility/prerequisites). Use it only to keep execution inside those bounds — do NOT re-rank paths, invent a second comparison table, scores, or probabilities.",
    "Do NOT restate full Page02 foundation or regenerate Page04 bottleneck essay.",
    "Do NOT emit Page07 field essay or a Page08 monitoring essay. Page08 actively consumes monitoring_contract fields; keep them structured here.",
    "Do NOT invent user reality facts or upgrade unverified/declined/unknown/conflict to confirmed.",
    "Do NOT mint claim/evidence ids outside the program registry in ## Production payload.",
    "Do NOT invent scores, success percentages, or unsourced numeric rankings.",
    "Do NOT fabricate validation experiments to pad counts — use experiments_absent_note when none.",
    "supporting_personal_unit_refs may cite ONLY Face02 content_units with kind=personal_interpretation (ids present in this payload). Do NOT use reality_fact / reality_mechanism / conditional_explanation unit ids there.",
    "supporting_reality_fact_ids must cite real DC fact ids from this payload.",
    "monitoring_contract.path_id must match every referenced action/experiment path_id — no mixed-path monitoring contracts.",
    "Vernacular body only — no raw metaphysics proper nouns.",
    `Locale: ${input.locale}`,
  ].join("\n");

  const payloadJson = JSON.stringify(input.production_payload, null, 2);

  const user = [
    "## Production payload (program-assembled; authoritative; read-only)",
    "Statuses are separated: confirmed / unverified / unknown / declined / conflict / not_applicable.",
    "Cite ONLY claim_ids and evidence_ids listed under registry.",
    "primary_path_id must be one of page05.preferred_path_ids.",
    "fallback_path_ids must be a subset of page05.alternative_path_ids.",
    "Every action, experiment, and adjustment path_id must be in page05.all_path_ids.",
    "Read page05.path_comparison.rows as frozen Page05 context — inherit cost/risk/resource/reversibility boundaries; do not rewrite comparison conclusions.",
    "Personal adjustment supporting_personal_unit_refs must be Face02 personal_interpretation unit_ids from page02.content_units; supporting_reality_fact_ids must be DC fact ids.",
    "Do NOT invent facts to fill missing_inputs.",
    "",
    "```json",
    payloadJson,
    "```",
    "",
    input.architecture_prompt_bundle,
    "",
    "## Output",
    "Return Face06V2 JSON with primary_path_id, first_step, execution_actions, validation_experiments, personal_execution_adjustments, resource_boundaries, phase_rhythm, monitoring_contract, evidence_boundary.",
  ].join("\n");

  return { system, user };
}
