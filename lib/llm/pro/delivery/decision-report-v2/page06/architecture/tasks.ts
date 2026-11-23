/**
 * Page06 model task definitions — architecture Batch 1.
 */

import type { Page06SectionId } from "./sections";

export const PAGE06_TASK_IDS = [
  "page06_execution_generate",
  "page06_execution_repair",
] as const;

export type Page06TaskId = (typeof PAGE06_TASK_IDS)[number];

export type Page06ModelTaskDefinition = {
  task_id: Page06TaskId;
  purpose: string;
  inputs: readonly string[];
  outputs: readonly string[];
  depends_on: readonly string[];
  on_failure:
    | "fail_closed_no_page"
    | "single_repair_then_fail"
    | "persist_incomplete";
  persist_to: string;
  sections: readonly Page06SectionId[];
  bans: readonly string[];
};

export const PAGE06_MODEL_TASKS: readonly Page06ModelTaskDefinition[] = [
  {
    task_id: "page06_execution_generate",
    purpose:
      "Generate Face06V2 strategy execution and validation for paths Page05 already chose.",
    inputs: [
      "page06_architecture_prompt_bundle",
      "page06_production_payload",
      "input_manifest",
      "missing_inputs",
      "evidence_registry",
      "json_schema_face06_v2",
      "page05_paths",
      "page01_structured",
      "page02_foundation",
      "page04_bottleneck",
    ],
    outputs: [
      "Face06V2 JSON (first_step + execution_actions + validation_experiments + adjustments + rhythm + resources + monitoring_contract + evidence_boundary)",
    ],
    depends_on: [
      "decision_context_snapshot",
      "page05_v2_preferred_paths",
      "page01_v2_available",
      "page02_v2_available",
      "page04_v2_available",
      "face06_production_context",
    ],
    on_failure: "single_repair_then_fail",
    persist_to: "lab.page_schemas['06'] / delivery page schema face 06",
    sections: [
      "first_step",
      "execution_actions",
      "validation_experiments",
      "personal_execution_adjustments",
      "phase_rhythm",
      "resource_boundaries",
      "evidence_boundary",
    ],
    bans: [
      "Invent missing reality facts",
      "Upgrade unverified/declined/unknown/conflict to confirmed",
      "Mint claim/evidence ids outside registry",
      "Invent a path_id that Page05 did not provide",
      "Copy Page05 comparison or Page01 conclusion as body",
      "Restate full Page02/Page04 as body",
      "Emit Page07 field essay or Page08 monitoring checklist essay",
      "Invent scores or success probabilities",
      "Fabricate validation experiments to pad counts",
      "Write a personal adjustment with no existing personal-unit or reality-fact ref",
      "Use legacy_ id prefixes",
    ],
  },
  {
    task_id: "page06_execution_repair",
    purpose:
      "One targeted repair after structure validation failure — same input bans.",
    inputs: [
      "previous_user_prompt",
      "previous_raw_json",
      "validation_issues",
      "input_manifest",
      "missing_inputs",
    ],
    outputs: ["Face06V2 JSON (repaired)"],
    depends_on: ["page06_execution_generate"],
    on_failure: "fail_closed_no_page",
    persist_to: "lab.page_schemas['06'] only if validation passes",
    sections: [
      "first_step",
      "execution_actions",
      "validation_experiments",
      "personal_execution_adjustments",
      "phase_rhythm",
      "resource_boundaries",
      "evidence_boundary",
    ],
    bans: [
      "Introduce new fact_ids not in payload",
      "Fill gaps with invented user facts",
      "Bypass schema validation",
      "Expand page duty beyond Strategy Execution & Validation",
      "Add path ids outside Page05",
    ],
  },
] as const;

export function page06TaskById(
  taskId: string,
): Page06ModelTaskDefinition | null {
  return PAGE06_MODEL_TASKS.find((t) => t.task_id === taskId) ?? null;
}
