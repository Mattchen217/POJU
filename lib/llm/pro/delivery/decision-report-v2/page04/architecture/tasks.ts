/**
 * Page04 model task definitions — architecture Batch 1.
 */

import type { Page04SectionId } from "./sections";

export const PAGE04_TASK_IDS = [
  "page04_content_units_generate",
  "page04_content_units_repair",
] as const;

export type Page04TaskId = (typeof PAGE04_TASK_IDS)[number];

export type Page04ModelTaskDefinition = {
  task_id: Page04TaskId;
  purpose: string;
  inputs: readonly string[];
  outputs: readonly string[];
  depends_on: readonly string[];
  on_failure:
    | "fail_closed_no_page"
    | "single_repair_then_fail"
    | "persist_incomplete";
  persist_to: string;
  sections: readonly Page04SectionId[];
  bans: readonly string[];
};

export const PAGE04_MODEL_TASKS: readonly Page04ModelTaskDefinition[] = [
  {
    task_id: "page04_content_units_generate",
    purpose:
      "Generate Face04V2 content_units + section assembly for Core Bottleneck only.",
    inputs: [
      "page04_architecture_prompt_bundle",
      "page04_feed_slice",
      "input_manifest",
      "missing_inputs",
      "evidence_registry",
      "json_schema_face04_v2",
      "page01_alignment",
      "page02_foundation_optional",
    ],
    outputs: [
      "Face04V2 JSON (content_units + *_unit_ids + evidence_boundary)",
    ],
    depends_on: [
      "decision_context_snapshot",
      "page01_core_judgment_available",
      "face04_production_context",
    ],
    on_failure: "single_repair_then_fail",
    persist_to: "lab.page_schemas['04'] / delivery page schema face 04",
    sections: [
      "bottleneck_naming",
      "manifestation",
      "force_through_cost",
      "leverage_point",
      "evidence_boundary",
    ],
    bans: [
      "Invent missing reality facts",
      "Upgrade unverified/declined/unknown to confirmed",
      "Mint evidence associations the program did not certify",
      "Copy Page01 conclusion as body",
      "Restate full Page02 foundation",
      "Emit Page05 path ranking / Page06 near-steps / Page07 field / Page08 close",
      "Scare-fate or inevitable disaster language",
    ],
  },
  {
    task_id: "page04_content_units_repair",
    purpose:
      "One targeted repair after structure validation failure — same input bans.",
    inputs: [
      "previous_user_prompt",
      "previous_raw_json",
      "validation_issues",
      "input_manifest",
      "missing_inputs",
    ],
    outputs: ["Face04V2 JSON (repaired)"],
    depends_on: ["page04_content_units_generate"],
    on_failure: "fail_closed_no_page",
    persist_to: "lab.page_schemas['04'] only if validation passes",
    sections: [
      "bottleneck_naming",
      "manifestation",
      "force_through_cost",
      "leverage_point",
      "evidence_boundary",
    ],
    bans: [
      "Introduce new fact_ids not in slice",
      "Fill gaps with invented user facts",
      "Bypass schema validation",
      "Expand page duty beyond Core Bottleneck",
    ],
  },
] as const;

export function page04TaskById(
  taskId: string,
): Page04ModelTaskDefinition | null {
  return PAGE04_MODEL_TASKS.find((t) => t.task_id === taskId) ?? null;
}
