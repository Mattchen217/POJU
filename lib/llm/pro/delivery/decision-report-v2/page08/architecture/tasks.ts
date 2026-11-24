/**
 * Page08 model task definitions — architecture Batch 1.
 * The model is invoked only after required Page01–06 inputs are present.
 * No global DAG and no OpenRouter call from this module.
 */

import type { Page08SectionId } from "./sections";

export const PAGE08_TASK_IDS = [
  "page08_monitoring_generate",
  "page08_monitoring_repair",
] as const;

export type Page08TaskId = (typeof PAGE08_TASK_IDS)[number];

export type Page08ModelTaskDefinition = {
  task_id: Page08TaskId;
  purpose: string;
  inputs: readonly string[];
  outputs: readonly string[];
  depends_on: readonly string[];
  on_failure:
    | "fail_closed_no_page"
    | "single_repair_then_fail"
    | "persist_incomplete";
  persist_to: string;
  sections: readonly Page08SectionId[];
  bans: readonly string[];
};

const SECTIONS: readonly Page08SectionId[] = [
  "risks",
  "observation_signals",
  "triggers",
  "reassessment_conditions",
  "evidence_boundary",
];

export const PAGE08_MODEL_TASKS: readonly Page08ModelTaskDefinition[] = [
  {
    task_id: "page08_monitoring_generate",
    purpose:
      "Generate Face08V2 risk monitoring and decision review from the program payload. Observe signals; respond with continue, adjust, pause, stop, or reassess.",
    inputs: [
      "page08_architecture_prompt_bundle",
      "page08_production_payload",
      "input_manifest",
      "missing_inputs",
      "evidence_registry",
      "json_schema_face08_v2",
      "page01_structured",
      "page02_foundation",
      "page04_bottleneck",
      "page05_paths",
      "page06_monitoring_contract",
      "page07_field_or_gap",
    ],
    outputs: [
      "Face08V2 JSON (risks + observation_signals + triggers + reassessment_conditions + evidence_boundary)",
    ],
    depends_on: [
      "decision_context_snapshot",
      "page01_v2_available",
      "page02_v2_available",
      "page04_v2_available",
      "page05_v2_preferred_paths",
      "page06_v2_monitoring_contract",
      "face08_production_context",
    ],
    on_failure: "single_repair_then_fail",
    persist_to: "lab.page_schemas['08'] / delivery page schema face 08",
    sections: SECTIONS,
    bans: [
      "Rewrite Page01, Page05, or Page06",
      "Invent facts, scores, probabilities, or calendar dates",
      "Upgrade unverified/declined/unknown facts to confirmed",
      "Mint claim or evidence ids outside the Page08 registry",
      "Invent Page05 path ids or Page06 action ids",
      "Cite a signal that does not name an existing risk",
      "Cite a trigger that does not name an existing risk and signal",
      "Treat a missing or insufficient Page07 as applicable",
      "Use legacy_ id prefixes",
      "Add a decision response other than continue, adjust, pause, stop, or reassess",
    ],
  },
  {
    task_id: "page08_monitoring_repair",
    purpose:
      "One targeted repair after structure validation failure — same input bans.",
    inputs: [
      "previous_user_prompt",
      "previous_raw_json",
      "validation_issues",
      "input_manifest",
      "missing_inputs",
    ],
    outputs: ["Face08V2 JSON (repaired)"],
    depends_on: ["page08_monitoring_generate"],
    on_failure: "fail_closed_no_page",
    persist_to: "lab.page_schemas['08'] only if validation passes",
    sections: SECTIONS,
    bans: [
      "Introduce new fact_ids, path ids, action ids, claim ids, or evidence ids",
      "Fill gaps by inventing risks or dates",
      "Bypass schema validation",
      "Rewrite upstream pages during repair",
    ],
  },
] as const;

export function page08TaskById(
  taskId: string,
): Page08ModelTaskDefinition | null {
  return PAGE08_MODEL_TASKS.find((t) => t.task_id === taskId) ?? null;
}
