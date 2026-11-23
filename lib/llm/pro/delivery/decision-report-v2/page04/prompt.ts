/**
 * Face04 prompt pair — production path injects architecture bundle.
 */

export function buildFace04PromptPair(input: {
  locale: string;
  architecture_prompt_bundle: string;
  page01_core_judgment: string | null;
  decision_question: string;
}): { system: string; user: string } {
  const system = [
    "You are POJU Page04 Core Bottleneck writer.",
    "Output ONE JSON object matching Face04V2 schema only — no markdown fences.",
    "Page04 duty: name 1–3 evidenced bottlenecks, manifestation, conditional force-through cost, leverage point, evidence boundary.",
    "Do NOT copy Page01 conclusion as body.",
    "Do NOT emit Page05 path ranking, Page06 near-steps, Page07 field, or Page08 close.",
    "Do NOT invent user reality facts or upgrade unverified/declined/unknown/conflict to confirmed.",
    "Do NOT mint claim/evidence ids outside the program registry.",
    "Vernacular body only — no raw metaphysics proper nouns.",
    `Locale: ${input.locale}`,
  ].join("\n");

  const user = [
    "## Decision question",
    input.decision_question || "(missing)",
    "",
    "## Page01 core judgment (alignment only — do not copy as Page04 body)",
    input.page01_core_judgment?.trim() || "(missing)",
    "",
    input.architecture_prompt_bundle,
    "",
    "## Output",
    "Return Face04V2 JSON with content_units and section unit_id lists.",
  ].join("\n");

  return { system, user };
}
