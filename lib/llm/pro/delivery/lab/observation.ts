/**
 * S6 — LAB full-chain observation record (engineering).
 * Attach to LabAttempt so Ops can trace Render → Validation → Response → Prompt → Input → Context.
 * Does not invent model-internal reasoning; only records obtainable fields.
 */

import type { DecisionContextBinding } from "@/lib/poju/decision-context";
import type { LabCallTrace } from "./call-trace";

export type LabObservationLayer = {
  stage: string;
  step_key?: string;
  page?: string | null;
  session_id?: string | null;
  lab_id?: string | null;
  job_id?: string | null;
  generation_id?: string | null;
  call_id?: string | null;
  context?: {
    binding: DecisionContextBinding | null;
    has_snapshot: boolean;
    status?: string | null;
    feed_injected?: boolean | null;
  };
  input?: Record<string, unknown>;
  prompt?: {
    system_chars: number;
    user_chars: number;
    user_feed_chars: number;
    has_formal_dc: boolean;
  };
  model?: {
    name?: string | null;
    thinking_effort?: string | null;
    provider_hint?: string | null;
    latency_ms?: number | null;
  };
  response?: {
    raw_chars: number;
    parsed_present: boolean;
    finish_reason?: string | null;
  };
  transform?: Array<{ action: string; detail?: string }>;
  validation?: {
    passed: boolean;
    failed_rule?: string | null;
    detail?: string | null;
  };
  render?: {
    preview_kind?: string | null;
    preview_chars?: number | null;
  };
};

export function buildLabObservation(input: {
  stage: string;
  step_key?: string;
  page?: string | null;
  session_id?: string | null;
  lab_id?: string | null;
  job_id?: string | null;
  call_trace?: LabCallTrace | null;
  input_payload?: unknown;
  processing_actions?: Array<{ action: string; detail?: string }>;
  gate_verdict?: { passed: boolean; failed_rule?: string; detail?: string };
  raw_model_output?: unknown;
  output_to_next_stage?: unknown;
  context_binding?: DecisionContextBinding | null;
  has_context_snapshot?: boolean;
  context_status?: string | null;
  dc_feed_injected?: boolean | null;
}): LabObservationLayer {
  const trace = input.call_trace ?? null;
  const system = trace?.system ?? "";
  const user = trace?.user ?? "";
  const userFeed = trace?.user_feed ?? "";
  const raw = trace?.raw_text ?? "";
  const hasFormalDc =
    input.dc_feed_injected === true ||
    /Formal Decision Context/i.test(userFeed) ||
    /Formal Decision Context/i.test(user);

  let previewChars: number | null = null;
  let previewKind: string | null = null;
  if (input.output_to_next_stage != null) {
    try {
      const s = JSON.stringify(input.output_to_next_stage);
      previewChars = s.length;
      previewKind = "output_to_next_stage";
    } catch {
      previewKind = "output_unserializable";
    }
  } else if (input.raw_model_output != null) {
    try {
      previewChars = JSON.stringify(input.raw_model_output).length;
      previewKind = "raw_model_output";
    } catch {
      previewKind = "raw_unserializable";
    }
  }

  return {
    stage: input.stage,
    step_key: input.step_key,
    page: input.page ?? null,
    session_id: input.session_id ?? null,
    lab_id: input.lab_id ?? null,
    job_id: input.job_id ?? null,
    generation_id: trace?.meta?.generation_id ?? null,
    call_id: trace?.meta?.generation_id ?? null,
    context: {
      binding: input.context_binding ?? null,
      has_snapshot: Boolean(input.has_context_snapshot),
      status: input.context_status ?? null,
      feed_injected: input.dc_feed_injected ?? hasFormalDc,
    },
    input:
      input.input_payload && typeof input.input_payload === "object"
        ? (input.input_payload as Record<string, unknown>)
        : { value: input.input_payload ?? null },
    prompt: {
      system_chars: system.length,
      user_chars: user.length,
      user_feed_chars: userFeed.length,
      has_formal_dc: hasFormalDc,
    },
    model: {
      name: trace?.meta?.actual_model ?? null,
      thinking_effort: trace?.meta?.thinking_effort ?? null,
      latency_ms: trace?.meta?.latency_ms ?? null,
    },
    response: {
      raw_chars: raw.length,
      parsed_present: trace?.parsed != null,
      finish_reason: trace?.meta?.finish_reason ?? null,
    },
    transform: input.processing_actions ?? [],
    validation: input.gate_verdict
      ? {
          passed: input.gate_verdict.passed,
          failed_rule: input.gate_verdict.failed_rule ?? null,
          detail: input.gate_verdict.detail ?? null,
        }
      : undefined,
    render: {
      preview_kind: previewKind,
      preview_chars: previewChars,
    },
  };
}
