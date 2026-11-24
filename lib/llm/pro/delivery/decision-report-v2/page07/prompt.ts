/**
 * Face07 prompt pair — production path injects architecture bundle + full payload.
 * Called only when applicability is already applicable.
 */

export type Face07ProductionPayload = {
  decision_question: string;
  locale: string;
  applicability_status: "applicable" | "not_applicable" | "insufficient_information";
  applicability_reason: string;
  authorized_partner_profile: boolean;
  page01: unknown;
  page02: {
    present: boolean;
    content_units: unknown[] | null;
    explanation_boundary: unknown | null;
    personal_interpretation_unit_ids: string[];
  };
  page04: {
    present: boolean;
    content_units: unknown[] | null;
    evidence_boundary: unknown | null;
  };
  page05: {
    present: boolean;
    preferred_path_ids: string[];
    all_path_ids: string[];
    path_units: unknown[] | null;
  };
  page06: {
    present: boolean;
    primary_path_id: string | null;
    action_ids: string[];
    first_step_what: string | null;
  };
  reality: {
    confirmed_facts: unknown[];
    unverified_facts: unknown[];
    declined_or_unknown_facts: unknown[];
    constraints: unknown[];
    dirs: unknown[];
  };
  book_judgment_face07_units: unknown[];
  registry: {
    claims: unknown[];
    evidence: unknown[];
  };
  input_manifest: unknown[];
  missing_inputs: unknown[];
};

export function buildFace07PromptPair(input: {
  locale: string;
  architecture_prompt_bundle: string;
  production_payload: Face07ProductionPayload;
}): { system: string; user: string } {
  const system = [
    "You are POJU Page07 Field & Relationship writer.",
    "Output ONE JSON object matching Face07V2 schema only — no markdown fences.",
    "The program already decided applicability. You are only called when applicability_status is applicable.",
    "Write field units and/or relationship units about settings and people already present in the payload.",
    "Do NOT invent third parties. A participant other than self must use a display_label that appears in a cited fact statement.",
    "Do NOT apply the user's personal analysis to anyone else.",
    "supporting_personal_unit_refs may cite ONLY Face02 content_units with kind=personal_interpretation, and only on units whose participant_ids are self.",
    "Do NOT describe another person's personality, character, or chart (性格/人格/命盘/对方天生) unless authorized_partner_profile is true.",
    "Do NOT invent path ids or Page06 action ids. related_page05_path_ids and related_page06_action_ids must be subsets of the payload.",
    "Do NOT change the Page01 recommendation or Page05 path order unless the cited field evidence requires it. Default both flags to false and say this page is an auxiliary condition.",
    "Do NOT invent a second main decision.",
    "Do NOT invent user reality facts or upgrade unverified/declined/unknown to confirmed.",
    "Do NOT mint claim/evidence ids outside the program registry.",
    "Do NOT invent scores, compatibility points, or probabilities.",
    "Vernacular body only — no raw metaphysics proper nouns.",
    `Locale: ${input.locale}`,
    `authorized_partner_profile: ${input.production_payload.authorized_partner_profile ? "true" : "false"}`,
  ].join("\n");

  const user = [
    "## Production payload (program-assembled; authoritative; read-only)",
    "Cite ONLY claim_ids and evidence_ids listed under registry.",
    "participant_id self is the user. Do not invent other participant_ids.",
    "Do NOT invent facts to fill missing_inputs.",
    "",
    "```json",
    JSON.stringify(input.production_payload, null, 2),
    "```",
    "",
    input.architecture_prompt_bundle,
    "",
    "## Output",
    "Return Face07V2 JSON with applicability_status=applicable, applicability_reason, participants, field_units and/or relationship_units, evidence_boundary, alignment_with_main.",
  ].join("\n");

  return { system, user };
}
