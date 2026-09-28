import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import { LAB_STEP_DEFS } from "@/lib/llm/pro/delivery/lab/types";
import { LAB_STEP_DEFS_V3 } from "@/lib/llm/pro/delivery/lab/types-v3";
import { tryStructuredFromBaseAnalysis } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";

function activeStepDefs(lab: DeliveryLabSession) {
  return lab.pipeline === "v3_three_step" ? LAB_STEP_DEFS_V3 : LAB_STEP_DEFS;
}

/** Ops API / UI payload — omit bulky base_analysis blob. */
export function labPublicView(lab: DeliveryLabSession) {
  const structured = tryStructuredFromBaseAnalysis(lab.source.base_analysis);
  const defs = activeStepDefs(lab);
  return {
    version: lab.version,
    lab_id: lab.lab_id,
    created_at: lab.created_at,
    updated_at: lab.updated_at,
    ops_user: lab.ops_user,
    pipeline: lab.pipeline ?? "legacy",
    cursor_index: lab.cursor_index,
    cursor_step: defs[lab.cursor_index]?.step_key ?? null,
    approved_order: lab.approved_order,
    steps: lab.steps,
    artifacts: lab.artifacts,
    source: {
      locale: lab.source.locale,
      original_question: lab.source.original_question,
      desired_outcome: lab.source.desired_outcome,
      session_id: lab.source.session_id,
      covered_agenda: lab.source.covered_agenda,
      has_breakthrough_core: lab.source.breakthrough_core != null,
      base_analysis_present: lab.source.base_analysis != null,
      structured_present: Boolean(structured),
    },
    step_defs: defs,
  };
}

export type LabPublicView = ReturnType<typeof labPublicView>;
