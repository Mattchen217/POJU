/**
 * Delivery Lab — step-through generation for ops quality inspection.
 * Click-to-run each stage; human approve unlocks the next. Same generators as production.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

export const LAB_TTL_SEC = 60 * 60 * 48;

export type LabStepStatus = "idle" | "running" | "done" | "failed" | "approved" | "stale";

export type LabGateVerdict = {
  passed: boolean;
  failed_rule?: string;
  detail?: string;
};

export type LabAttempt = {
  attempt_number: number;
  timestamp: string;
  duration_ms: number;
  generation_id?: string | null;
  tokens_used?: number;
  input_payload: unknown;
  raw_model_output: unknown;
  processing_actions: Array<{ action: string; detail?: string }>;
  gate_verdict: LabGateVerdict;
  output_to_next_stage: unknown;
  error?: string;
};

export type LabStepRecord = {
  step_key: string;
  status: LabStepStatus;
  attempts: LabAttempt[];
  approved_attempt?: number;
};

export type LabSource = {
  locale: string;
  original_question: string;
  desired_outcome?: string;
  /** Full base_analysis row (must include structured for thesis). */
  base_analysis: unknown;
  breakthrough_core?: unknown | null;
  covered_agenda?: Array<{ label: string; answer?: string }>;
  session_id?: string;
  /** Optional — drives topic_slice hints in thesis feed only. */
  question_category?: string | null;
};

export type LabArtifacts = {
  thesis?: unknown;
  prealloc?: unknown;
  /** page → assignment / plan / page_schema / marked */
  by_page: Partial<
    Record<
      DeliverySegmentKey,
      {
        assignment?: unknown;
        plan?: unknown;
        write_units?: unknown[];
        /** Mark arg-chunk progress (connective partials). */
        mark_partial?: unknown;
        mark_chunk_index?: number;
        page_schema?: unknown;
        evidence?: unknown;
        marked?: unknown;
        core_conclusion?: string;
      }
    >
  >;
  assemble_preview?: string;
};

export type DeliveryLabSession = {
  version: 1;
  lab_id: string;
  created_at: number;
  updated_at: number;
  ops_user: string;
  source: LabSource;
  /** Index into LAB_STEP_DEFS */
  cursor_index: number;
  steps: Record<string, LabStepRecord>;
  artifacts: LabArtifacts;
  approved_order: string[];
};

export type LabStepDef = {
  step_key: string;
  label: string;
  /** Segment page when step is page-scoped */
  page?: DeliverySegmentKey;
  kind:
    | "bootstrap"
    | "thesis"
    | "prealloc"
    | "assign"
    | "write"
    | "write_merge"
    | "fill"
    | "mark"
    | "assemble";
  /** Needs LLM ( forewarn long wait ) */
  uses_llm: boolean;
};

/** Fixed order — unlock only after prior approve. */
export const LAB_STEP_DEFS: readonly LabStepDef[] = [
  { step_key: "bootstrap", label: "Bootstrap · 校验盘/问题", kind: "bootstrap", uses_llm: false },
  { step_key: "thesis.gen", label: "Thesis · 命盘总纲", kind: "thesis", uses_llm: false },
  { step_key: "prealloc", label: "Prealloc · 全书 primary", kind: "prealloc", uses_llm: false },
  // Wave A deep pages
  {
    step_key: "foundation.assign",
    label: "P2 assign",
    page: "foundation",
    kind: "assign",
    uses_llm: true,
  },
  {
    step_key: "foundation.write",
    label: "P2 write",
    page: "foundation",
    kind: "write",
    uses_llm: true,
  },
  {
    step_key: "foundation.write_merge",
    label: "P2 write.merge · quality",
    page: "foundation",
    kind: "write_merge",
    uses_llm: false,
  },
  {
    step_key: "foundation.fill",
    label: "P2 fill",
    page: "foundation",
    kind: "fill",
    uses_llm: true,
  },
  {
    step_key: "foundation.mark",
    label: "P2 mark+polish",
    page: "foundation",
    kind: "mark",
    uses_llm: true,
  },
  {
    step_key: "science_action.assign",
    label: "P3 assign",
    page: "science_action",
    kind: "assign",
    uses_llm: true,
  },
  {
    step_key: "science_action.write",
    label: "P3 write",
    page: "science_action",
    kind: "write",
    uses_llm: true,
  },
  {
    step_key: "science_action.write_merge",
    label: "P3 write.merge",
    page: "science_action",
    kind: "write_merge",
    uses_llm: false,
  },
  {
    step_key: "science_action.fill",
    label: "P3 fill",
    page: "science_action",
    kind: "fill",
    uses_llm: true,
  },
  {
    step_key: "science_action.mark",
    label: "P3 mark+polish",
    page: "science_action",
    kind: "mark",
    uses_llm: true,
  },
  {
    step_key: "metaphysics_action.assign",
    label: "P4 assign",
    page: "metaphysics_action",
    kind: "assign",
    uses_llm: true,
  },
  {
    step_key: "metaphysics_action.write",
    label: "P4 write",
    page: "metaphysics_action",
    kind: "write",
    uses_llm: true,
  },
  {
    step_key: "metaphysics_action.write_merge",
    label: "P4 write.merge",
    page: "metaphysics_action",
    kind: "write_merge",
    uses_llm: false,
  },
  {
    step_key: "metaphysics_action.fill",
    label: "P4 fill",
    page: "metaphysics_action",
    kind: "fill",
    uses_llm: true,
  },
  {
    step_key: "metaphysics_action.mark",
    label: "P4 mark+polish",
    page: "metaphysics_action",
    kind: "mark",
    uses_llm: true,
  },
  {
    step_key: "direct_answer.fill",
    label: "P1 fill",
    page: "direct_answer",
    kind: "fill",
    uses_llm: true,
  },
  {
    step_key: "risk_guard.assign",
    label: "P5 assign",
    page: "risk_guard",
    kind: "assign",
    uses_llm: true,
  },
  {
    step_key: "risk_guard.write",
    label: "P5 write",
    page: "risk_guard",
    kind: "write",
    uses_llm: true,
  },
  {
    step_key: "risk_guard.write_merge",
    label: "P5 write.merge",
    page: "risk_guard",
    kind: "write_merge",
    uses_llm: false,
  },
  {
    step_key: "risk_guard.fill",
    label: "P5 fill",
    page: "risk_guard",
    kind: "fill",
    uses_llm: true,
  },
  {
    step_key: "risk_guard.mark",
    label: "P5 mark+polish",
    page: "risk_guard",
    kind: "mark",
    uses_llm: true,
  },
  {
    step_key: "signals_close.assign",
    label: "P6 assign",
    page: "signals_close",
    kind: "assign",
    uses_llm: true,
  },
  {
    step_key: "signals_close.write",
    label: "P6 write",
    page: "signals_close",
    kind: "write",
    uses_llm: true,
  },
  {
    step_key: "signals_close.write_merge",
    label: "P6 write.merge",
    page: "signals_close",
    kind: "write_merge",
    uses_llm: false,
  },
  {
    step_key: "signals_close.fill",
    label: "P6 fill",
    page: "signals_close",
    kind: "fill",
    uses_llm: true,
  },
  {
    step_key: "signals_close.mark",
    label: "P6 mark+polish",
    page: "signals_close",
    kind: "mark",
    uses_llm: true,
  },
  {
    step_key: "book.assemble",
    label: "Assemble · 预览拼书",
    kind: "assemble",
    uses_llm: false,
  },
] as const;

export function labStepDef(step_key: string): LabStepDef | undefined {
  return LAB_STEP_DEFS.find((s) => s.step_key === step_key);
}

export function emptyStepRecord(step_key: string): LabStepRecord {
  return { step_key, status: "idle", attempts: [] };
}

export function initLabSteps(): Record<string, LabStepRecord> {
  const out: Record<string, LabStepRecord> = {};
  for (const d of LAB_STEP_DEFS) out[d.step_key] = emptyStepRecord(d.step_key);
  return out;
}
