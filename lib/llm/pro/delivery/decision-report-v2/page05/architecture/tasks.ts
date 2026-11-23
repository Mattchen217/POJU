/**
 * Page05 model task definitions — architecture Batch 1.
 */

import type { Page05SectionId } from "./sections";

export const PAGE05_TASK_IDS = [
  "page05_paths_generate",
  "page05_paths_repair",
] as const;

export type Page05TaskId = (typeof PAGE05_TASK_IDS)[number];

export type Page05ModelTaskDefinition = {
  task_id: Page05TaskId;
  purpose: string;
  inputs: readonly string[];
  outputs: readonly string[];
  depends_on: readonly string[];
  on_failure:
    | "fail_closed_no_page"
    | "single_repair_then_fail"
    | "persist_incomplete";
  persist_to: string;
  sections: readonly Page05SectionId[];
  bans: readonly string[];
};

export const PAGE05_MODEL_TASKS: readonly Page05ModelTaskDefinition[] = [
  {
    task_id: "page05_paths_generate",
    purpose:
      "Generate Face05V2 path_units + comparison + switching_rules for Feasible Paths only.",
    inputs: [
      "page05_architecture_prompt_bundle",
      "page05_production_payload",
      "input_manifest",
      "missing_inputs",
      "evidence_registry",
      "json_schema_face05_v2",
      "page01_structured",
      "page02_foundation",
      "page04_bottleneck",
    ],
    outputs: [
      "Face05V2 JSON (path_units + path_comparison + switching_rules + evidence_boundary)",
    ],
    depends_on: [
      "decision_context_snapshot",
      "page01_v2_available",
      "page02_v2_available",
      "page04_v2_available",
      "face05_production_context",
    ],
    on_failure: "single_repair_then_fail",
    persist_to: "lab.page_schemas['05'] / delivery page schema face 05",
    sections: [
      "preferred_path",
      "alternative_path",
      "cautious_path",
      "switching_exit",
      "path_comparison",
    ],
    bans: [
      "Invent missing reality facts",
      "Upgrade unverified/declined/unknown/conflict to confirmed",
      "Mint claim/evidence ids outside registry",
      "Copy Page01 conclusion as body",
      "Restate full Page02/Page04 as body",
      "Emit Page06 near-steps / Page07 field essay / Page08 monitoring checklist",
      "Invent scores or success probabilities",
      "Fabricate cautious paths to pad counts",
      "Use legacy_ id prefixes",
    ],
  },
  {
    task_id: "page05_paths_repair",
    purpose:
      "One targeted repair after structure validation failure — same input bans.",
    inputs: [
      "previous_user_prompt",
      "previous_raw_json",
      "validation_issues",
      "input_manifest",
      "missing_inputs",
    ],
    outputs: ["Face05V2 JSON (repaired)"],
    depends_on: ["page05_paths_generate"],
    on_failure: "fail_closed_no_page",
    persist_to: "lab.page_schemas['05'] only if validation passes",
    sections: [
      "preferred_path",
      "alternative_path",
      "cautious_path",
      "switching_exit",
      "path_comparison",
    ],
    bans: [
      "Introduce new fact_ids not in payload",
      "Fill gaps with invented user facts",
      "Bypass schema validation",
      "Expand page duty beyond Feasible Paths",
    ],
  },
] as const;

export function page05TaskById(
  taskId: string,
): Page05ModelTaskDefinition | null {
  return PAGE05_MODEL_TASKS.find((t) => t.task_id === taskId) ?? null;
}
