/**
 * Page02 model task definitions — architecture Batch 1.
 * Defines call interface without requiring a live quality evaluation.
 */

import type { Page02SectionId } from "./sections";

export const PAGE02_TASK_IDS = [
  "page02_content_units_generate",
  "page02_content_units_repair",
] as const;

export type Page02TaskId = (typeof PAGE02_TASK_IDS)[number];

export type Page02ModelTaskDefinition = {
  task_id: Page02TaskId;
  purpose: string;
  inputs: readonly string[];
  outputs: readonly string[];
  depends_on: readonly string[];
  on_failure:
    | "fail_closed_no_page"
    | "single_repair_then_fail"
    | "persist_incomplete";
  persist_to: string;
  /** Sections this task is allowed to fill. */
  sections: readonly Page02SectionId[];
  /** Hard bans for the task role. */
  bans: readonly string[];
};

export const PAGE02_MODEL_TASKS: readonly Page02ModelTaskDefinition[] = [
  {
    task_id: "page02_content_units_generate",
    purpose:
      "Generate Face02V2 content_units + section assembly from certified inputs only.",
    inputs: [
      "page02_architecture_prompt_bundle",
      "page02_feed_slice",
      "input_manifest",
      "missing_inputs",
      "evidence_registry",
      "credible_fact_claim_pairs",
      "json_schema_face02_v2",
    ],
    outputs: [
      "Face02V2 JSON (content_units + *_unit_ids + explanation_boundary)",
    ],
    depends_on: [
      "decision_context_snapshot",
      "page01_core_judgment_available",
      "face02_production_context",
    ],
    on_failure: "single_repair_then_fail",
    persist_to: "lab.page_schemas['02'] / delivery page schema face 02",
    sections: [
      "page_summary",
      "relevant_personal_factors",
      "personal_reality_interplay",
      "why_judgment_fits",
      "explanation_boundary",
    ],
    bans: [
      "Invent missing reality facts",
      "Upgrade unverified/declined/unknown to confirmed",
      "Mint evidence associations the program did not certify",
      "Copy Page01 conclusion as body",
      "Emit Page04/05/06 content",
    ],
  },
  {
    task_id: "page02_content_units_repair",
    purpose:
      "One targeted repair after structure validation failure — same input bans.",
    inputs: [
      "previous_user_prompt",
      "previous_raw_json",
      "validation_issues",
      "input_manifest",
      "missing_inputs",
    ],
    outputs: ["Face02V2 JSON (repaired)"],
    depends_on: ["page02_content_units_generate"],
    on_failure: "fail_closed_no_page",
    persist_to: "lab.page_schemas['02'] only if validation passes",
    sections: [
      "page_summary",
      "relevant_personal_factors",
      "personal_reality_interplay",
      "why_judgment_fits",
      "explanation_boundary",
    ],
    bans: [
      "Introduce new fact_ids not in slice",
      "Fill gaps with invented user facts",
      "Bypass schema validation",
    ],
  },
] as const;

export function page02TaskById(
  taskId: string,
): Page02ModelTaskDefinition | null {
  return PAGE02_MODEL_TASKS.find((t) => t.task_id === taskId) ?? null;
}
