/**
 * Face08 prompt pair — production path injects architecture bundle + full payload.
 * Observe signals. Respond continue / adjust / pause / stop / reassess.
 * Do not rewrite Page01, Page05, or Page06. Do not invent facts, scores, or dates.
 */

export type Face08ProductionPayload = {
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
    all_path_ids: string[];
    path_units: unknown[] | null;
    switching_rules: unknown[] | null;
  };
  page06: {
    present: boolean;
    has_monitoring_contract: boolean;
    primary_path_id: string | null;
    action_ids: string[];
    first_step: unknown;
    execution_actions: unknown[] | null;
    validation_experiments: unknown[] | null;
    monitoring_contract: unknown;
    evidence_boundary: unknown;
    resource_boundaries: unknown;
    phase_rhythm: unknown;
  };
  page07: {
    presence: "missing" | "not_applicable" | "insufficient_information" | "applicable";
    applicability_status: string | null;
    applicability_reason: string | null;
    participants: unknown[];
    field_units: unknown[];
    relationship_units: unknown[];
    alignment_with_main: unknown | null;
    evidence_boundary: unknown | null;
    related_page05_path_ids: string[];
    related_page06_action_ids: string[];
    effect_on_page06_execution: string | null;
  };
  reality: {
    all_facts: unknown[];
    confirmed_facts: unknown[];
    unverified_facts: unknown[];
    declined_or_unknown_facts: unknown[];
    constraints: unknown[];
    dirs: unknown[];
  };
  book_judgment_face08_units: unknown[];
  registry: {
    claims: unknown[];
    evidence: unknown[];
  };
  input_manifest: unknown[];
  missing_inputs: unknown[];
};

export function buildFace08PromptPair(input: {
  locale: string;
  architecture_prompt_bundle: string;
  production_payload: Face08ProductionPayload;
}): { system: string; user: string } {
  const system = [
    "You are POJU Page08 Risk Monitoring & Decision Review writer (08｜风险监测与决策复盘).",
    "Output ONE JSON object matching Face08V2 schema only — no markdown fences.",
    "Observe signals that already exist in the payload. The decision response on every trigger is exactly one of: continue, adjust, pause, stop, reassess.",
    "Do NOT rewrite Page01, Page05, or Page06. Do NOT invent a new path, action, or main recommendation.",
    "Do NOT invent user reality facts, scores, probabilities, or calendar dates.",
    "Do NOT upgrade unverified, declined, or unknown facts to confirmed.",
    "Do NOT upgrade user_estimate or user_asserted to independently_verified.",
    "confirmed_fact_ids may list only facts whose payload status is confirmed.",
    "unverified_fact_ids may list only facts whose payload status is unverified.",
    "Every cited reality fact needs a matching reality_fact_stances entry {fact_id, stance}.",
    "stance must match DC status/verification_level: as_confirmed only for status=confirmed; as_independently_verified only when verification_level=independently_verified; as_estimated only for user_estimate; as_unverified for status=unverified; as_conditional for conditional framing; as_unknown for unknown|declined|not_applicable.",
    "risks, observation_signals, and triggers MAY be empty arrays when the payload lacks enough basis. Explain insufficiency in evidence_boundary.monitoring_limitations / unresolved_questions. Do NOT invent filler risks, signals, or triggers.",
    "Every observation signal must cite related_risk_ids that you also output.",
    "Every trigger must cite related_risk_ids and related_signal_ids that you also output.",
    "If a trigger cites non-confirmed facts, set trigger_status=conditional (or pending_confirmation) and use as_conditional / as_unverified / as_estimated stance — never as_confirmed.",
    "related_path_ids and affected_path_ids must be a subset of page05.all_path_ids.",
    "related_action_ids must be a subset of page06.action_ids.",
    "Cite ONLY claim_ids and evidence_ids listed under registry.",
    "Page07 presence=not_applicable is allowed context and is not a block. Do not turn it into applicable.",
    "Page07 presence=insufficient_information is a gap. Do not invent an applicable field analysis.",
    "Page07 presence=missing is a gap. Do not invent participants or field facts.",
    "Page07 presence=applicable: use only the participants, units, and alignment already in the payload.",
    "Do NOT use legacy_ id prefixes.",
    "Omit generation_status, input_manifest, missing_inputs, sections, and generation_metadata. The program attaches them.",
    "Vernacular body only — no raw metaphysics proper nouns.",
    `Locale: ${input.locale}`,
  ].join("\n");

  const user = [
    "## Production payload (program-assembled; authoritative; read-only)",
    "Fact status and verification_level fields are authoritative. Do not change them.",
    "Cite ONLY claim_ids and evidence_ids listed under registry.",
    "Do NOT invent facts, paths, actions, scores, or dates to fill missing_inputs.",
    "Empty risks/signals/triggers are allowed when monitoring basis is insufficient.",
    "",
    "```json",
    JSON.stringify(input.production_payload, null, 2),
    "```",
    "",
    input.architecture_prompt_bundle,
    "",
    "## Output",
    "Return Face08V2 JSON with risks, observation_signals, triggers, reassessment_conditions, and evidence_boundary.",
    "Include reality_fact_stances for every cited fact. decision_response must be continue, adjust, pause, stop, or reassess.",
  ].join("\n");

  return { system, user };
}
