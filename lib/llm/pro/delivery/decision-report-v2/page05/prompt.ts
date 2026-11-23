/**
 * Face05 prompt pair — production path injects architecture bundle + full payload.
 */

export type Face05ProductionPayload = {
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
  reality: {
    confirmed_facts: unknown[];
    unverified_facts: unknown[];
    declined_or_unknown_facts: unknown[];
    open_conflicts: unknown[];
    constraints: unknown[];
    dirs: unknown[];
  };
  book_judgment_face05_units: unknown[];
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

export function buildFace05PromptPair(input: {
  locale: string;
  architecture_prompt_bundle: string;
  production_payload: Face05ProductionPayload;
}): { system: string; user: string } {
  const system = [
    "You are POJU Page05 Feasible Paths & Strategy Comparison writer.",
    "Output ONE JSON object matching Face05V2 schema only — no markdown fences.",
    "Page05 duty: 2–4 real feasible paths; preferred / alternative / cautious; switching & stop; qualitative comparison.",
    "Do NOT copy Page01 conclusion as body — expand into comparable concrete paths.",
    "Do NOT restate full Page02 foundation or regenerate Page04 bottleneck essay.",
    "Do NOT emit Page06 near-steps, Page07 field essay, or Page08 monitoring checklist.",
    "Do NOT invent user reality facts or upgrade unverified/declined/unknown/conflict to confirmed.",
    "Do NOT mint claim/evidence ids outside the program registry in ## Production payload.",
    "Do NOT invent scores, success percentages, or unsourced numeric rankings.",
    "Do NOT fabricate cautious paths to pad counts — use evidence_boundary.cautious_absent_note when none.",
    "Vernacular body only — no raw metaphysics proper nouns.",
    `Locale: ${input.locale}`,
  ].join("\n");

  const payloadJson = JSON.stringify(input.production_payload, null, 2);

  const user = [
    "## Production payload (program-assembled; authoritative; read-only)",
    "Statuses are separated: confirmed / unverified / unknown / declined / conflict / not_applicable.",
    "Cite ONLY claim_ids and evidence_ids listed under registry.",
    "supporting_page01_refs / page02 / page04 refs must point at real upstream objects in this payload.",
    "Do NOT invent facts to fill missing_inputs.",
    "",
    "```json",
    payloadJson,
    "```",
    "",
    input.architecture_prompt_bundle,
    "",
    "## Output",
    "Return Face05V2 JSON with path_units, preferred/alternative/cautious id lists, path_comparison, switching_rules, evidence_boundary.",
  ].join("\n");

  return { system, user };
}
