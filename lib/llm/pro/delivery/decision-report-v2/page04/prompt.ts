/**
 * Face04 prompt pair — production path injects architecture bundle + full payload.
 */

export type Face04ProductionPayload = {
  decision_question: string;
  locale: string;
  page01: {
    core_judgment: string | null;
    recommendation_conditions: Array<{
      condition: string;
      status: string;
      source_ids?: readonly string[];
    }>;
  };
  page02: {
    present: boolean;
    content_units: unknown[] | null;
    explanation_boundary: unknown | null;
  };
  page03: { available: boolean };
  reality: {
    confirmed_facts: unknown[];
    unverified_facts: unknown[];
    declined_or_unknown_facts: unknown[];
    open_conflicts: unknown[];
    constraints: unknown[];
  };
  book_judgment_face04_units: unknown[];
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

export function buildFace04PromptPair(input: {
  locale: string;
  architecture_prompt_bundle: string;
  production_payload: Face04ProductionPayload;
}): { system: string; user: string } {
  const system = [
    "You are POJU Page04 Core Bottleneck writer.",
    "Output ONE JSON object matching Face04V2 schema only — no markdown fences.",
    "Page04 duty: name 1–3 evidenced bottlenecks, manifestation, conditional force-through cost, leverage point, evidence boundary.",
    "Do NOT copy Page01 conclusion as body.",
    "Do NOT emit Page05 path ranking, Page06 near-steps, Page07 field, or Page08 close.",
    "Do NOT invent user reality facts or upgrade unverified/declined/unknown/conflict to confirmed.",
    "Do NOT mint claim/evidence ids outside the program registry in ## Production payload.",
    "evidence_boundary.confirmed_fact_ids may ONLY list fact_ids whose status is confirmed in the payload.",
    "Vernacular body only — no raw metaphysics proper nouns.",
    `Locale: ${input.locale}`,
  ].join("\n");

  const payloadJson = JSON.stringify(input.production_payload, null, 2);

  const user = [
    "## Production payload (program-assembled; authoritative; read-only)",
    "Statuses are separated: confirmed / unverified / unknown / declined / conflict / not_applicable.",
    "Cite ONLY claim_ids and evidence_ids listed under registry.",
    "Do NOT invent facts to fill missing_inputs.",
    "",
    "```json",
    payloadJson,
    "```",
    "",
    input.architecture_prompt_bundle,
    "",
    "## Output",
    "Return Face04V2 JSON with content_units and section unit_id lists.",
  ].join("\n");

  return { system, user };
}
