import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import { LAB_STEP_DEFS } from "@/lib/llm/pro/delivery/lab/types";
import { tryStructuredFromBaseAnalysis } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";

/** Ops API / UI payload — omit bulky base_analysis blob. */
export function labPublicView(lab: DeliveryLabSession) {
  const structured = tryStructuredFromBaseAnalysis(lab.source.base_analysis);
  return {
    version: lab.version,
    lab_id: lab.lab_id,
    created_at: lab.created_at,
    updated_at: lab.updated_at,
    ops_user: lab.ops_user,
    cursor_index: lab.cursor_index,
    cursor_step: LAB_STEP_DEFS[lab.cursor_index]?.step_key ?? null,
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
    step_defs: LAB_STEP_DEFS,
  };
}

export type LabPublicView = ReturnType<typeof labPublicView>;
