/**
 * Page07 model task definitions — architecture Batch 1.
 * The model is invoked only after applicability === applicable.
 */

import type { Page07SectionId } from "./sections";

export const PAGE07_TASK_IDS = [
  "page07_field_generate",
  "page07_field_repair",
] as const;

export type Page07TaskId = (typeof PAGE07_TASK_IDS)[number];

export type Page07ModelTaskDefinition = {
  task_id: Page07TaskId;
  purpose: string;
  inputs: readonly string[];
  outputs: readonly string[];
  depends_on: readonly string[];
  on_failure:
    | "fail_closed_no_page"
    | "single_repair_then_fail"
    | "persist_incomplete";
  persist_to: string;
  sections: readonly Page07SectionId[];
  bans: readonly string[];
};

const SECTIONS: readonly Page07SectionId[] = [
  "field_judgment",
  "relationship_interaction",
  "evidence_boundary",
  "alignment_with_main",
];

export const PAGE07_MODEL_TASKS: readonly Page07ModelTaskDefinition[] = [
  {
    task_id: "page07_field_generate",
    purpose:
      "Generate Face07V2 field and relationship analysis only when the program already marked the page applicable.",
    inputs: [
      "page07_architecture_prompt_bundle",
      "page07_production_payload",
      "input_manifest",
      "missing_inputs",
      "evidence_registry",
      "json_schema_face07_v2",
      "page01_structured",
      "page02_foundation",
      "page04_bottleneck",
      "page05_paths",
      "page06_execution",
    ],
    outputs: [
      "Face07V2 JSON (participants + field_units + relationship_units + evidence_boundary + alignment_with_main)",
    ],
    depends_on: [
      "decision_context_snapshot",
      "applicability_status_applicable",
      "page01_v2_available",
      "page02_v2_available",
      "page04_v2_available",
      "page05_v2_preferred_paths",
      "page06_v2_primary_path",
      "face07_production_context",
    ],
    on_failure: "single_repair_then_fail",
    persist_to: "lab.page_schemas['07'] / delivery page schema face 07",
    sections: SECTIONS,
    bans: [
      "Invent a third party who is not named in a cited fact",
      "Apply the user's personal_interpretation unit to anyone other than self",
      "Write third-party personality, character, or chart language without an authorized partner profile",
      "Invent missing reality facts",
      "Upgrade unverified/declined/unknown to confirmed",
      "Mint claim/evidence ids outside the registry",
      "Invent Page05 path ids or Page06 action ids",
      "Create a second main decision that conflicts with Page01",
      "Invent scores, compatibility points, or probabilities",
      "Use legacy_ id prefixes",
    ],
  },
  {
    task_id: "page07_field_repair",
    purpose:
      "One targeted repair after structure validation failure — same input bans.",
    inputs: [
      "previous_user_prompt",
      "previous_raw_json",
      "validation_issues",
      "input_manifest",
      "missing_inputs",
    ],
    outputs: ["Face07V2 JSON (repaired)"],
    depends_on: ["page07_field_generate"],
    on_failure: "fail_closed_no_page",
    persist_to: "lab.page_schemas['07'] only if validation passes",
    sections: SECTIONS,
    bans: [
      "Introduce new fact_ids, participant names, path ids, or action ids",
      "Fill gaps by inventing people or field facts",
      "Bypass schema validation",
      "Turn a skipped page into an analysis",
    ],
  },
] as const;

export function page07TaskById(
  taskId: string,
): Page07ModelTaskDefinition | null {
  return PAGE07_MODEL_TASKS.find((t) => t.task_id === taskId) ?? null;
}
