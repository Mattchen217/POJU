import { runDeliveryFinalize } from "@/lib/llm/pro/delivery/finalize-call";
import {
  runDeliveryEvidence,
  runDeliveryNarrative,
} from "@/lib/llm/pro/delivery/narrative-evidence-call";
import { runMarkDeliveryEvidence } from "@/lib/llm/pro/delivery/mark-evidence-call";
import { mergeDeliveryToMarkdown } from "@/lib/llm/pro/delivery/merge-delivery-markdown";
import { sanitizeDeliveryBookMarkdown } from "@/lib/llm/pro/delivery/sanitize-delivery-book";
import { translateDeliveryBookTrees } from "@/lib/llm/pro/delivery/translate-delivery-segment";
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import type { DeliveryMode } from "@/lib/poju/collection-progress";

export type DeliveryReportTimings = {
  finalize_ms?: number;
  narrative_ms?: number;
  evidence_ms?: number;
  mark_ms?: number;
  translate_ms?: number;
  total_ms?: number;
};

export type DeliveryReportOutcome =
  | {
      ok: true;
      full_text: string;
      model: string;
      tokens_used: number;
      timings: DeliveryReportTimings;
    }
  | {
      ok: false;
      stage: "finalize" | "narrative" | "evidence" | "mark" | "translate";
      reason: string;
      timings: DeliveryReportTimings;
    };

/**
 * Phase 4 orchestrator:
 *   finalize → narrative(zh) → evidence(真算) → code-mark + connective mark (delivery locale)
 *            → [body translate if !zh] → merge → sanitize
 *
 * Multilingual: mark writes target-language connective around SSOT soft markers;
 * translate covers narrative body only (never re-translates evidence).
 */
export async function runDeliveryReport(input: {
  breakthrough_core: BreakthroughCore | null;
  covered_agenda: Array<{ label: string; answer?: string }>;
  agent_v2: POJUAgentState;
  locale: string;
  delivery_mode: DeliveryMode;
  base_analysis?: unknown | null;
  session_id?: string;
}): Promise<DeliveryReportOutcome> {
  const t0 = Date.now();
  const timings: DeliveryReportTimings = {};
  let tokens_used = 0;
  let model = "";

  // Upgrade empty dashboard scores before finalize/merge (chart-sourced pack).
  const { attachMetaphysicsPackToBreakthroughCore } = await import(
    "@/lib/poju/attach-metaphysics-pack"
  );
  const breakthrough_core = input.breakthrough_core
    ? attachMetaphysicsPackToBreakthroughCore(
        input.breakthrough_core,
        input.base_analysis ?? null,
      )
    : null;

  const tFinalize = Date.now();
  const finalized = await runDeliveryFinalize({
    breakthrough_core,
    covered_agenda: input.covered_agenda,
    agent_v2: input.agent_v2,
    locale: input.locale,
    delivery_mode: input.delivery_mode,
    session_id: input.session_id,
  });
  timings.finalize_ms = Date.now() - tFinalize;

  if (!finalized.ok) {
    timings.total_ms = Date.now() - t0;
    return { ok: false, stage: "finalize", reason: finalized.reason, timings };
  }
  tokens_used += finalized.tokens_used;
  model = finalized.model || model;

  const tNarr = Date.now();
  const narrative = await runDeliveryNarrative(finalized.value, "zh", {
    session_id: input.session_id,
  });
  timings.narrative_ms = Date.now() - tNarr;
  if (!narrative.ok) {
    timings.total_ms = Date.now() - t0;
    return { ok: false, stage: "narrative", reason: narrative.reason, timings };
  }
  tokens_used += narrative.tokens_used;

  const tEv = Date.now();
  const evidence = await runDeliveryEvidence(finalized.value, narrative.value, {
    session_id: input.session_id,
  });
  timings.evidence_ms = Date.now() - tEv;
  if (!evidence.ok) {
    timings.total_ms = Date.now() - t0;
    return { ok: false, stage: "evidence", reason: evidence.reason, timings };
  }
  tokens_used += evidence.tokens_used;

  const tMark = Date.now();
  const marked = await runMarkDeliveryEvidence(evidence.value, input.locale, {
    session_id: input.session_id,
    original_question: input.agent_v2.original_question,
  });
  timings.mark_ms = Date.now() - tMark;
  if (!marked.ok) {
    timings.total_ms = Date.now() - t0;
    return { ok: false, stage: "mark", reason: marked.reason, timings };
  }
  tokens_used += marked.tokens_used;

  let narrativeForMerge = narrative.value;
  let evidenceForMerge = marked.value;
  if (!input.locale.startsWith("zh")) {
    const tTr = Date.now();
    try {
      const tr = await translateDeliveryBookTrees(
        narrative.value,
        marked.value,
        input.locale,
        input.session_id,
      );
      narrativeForMerge = tr.narrative;
      evidenceForMerge = tr.evidence;
      tokens_used += tr.tokens_used;
      if (tr.model) model = tr.model;
      timings.translate_ms = Date.now() - tTr;
    } catch (e) {
      timings.total_ms = Date.now() - t0;
      return {
        ok: false,
        stage: "translate",
        reason: e instanceof Error ? e.message : String(e),
        timings,
      };
    }
  }

  const bookMeta = {
    original_question: input.agent_v2.original_question,
    locale: input.locale,
    report_id: input.session_id ? `POJU-${input.session_id.slice(0, 8)}` : undefined,
    generated_at: new Date().toISOString(),
    base_analysis: input.base_analysis ?? null,
    breakthrough_core,
  };
  const markdown = mergeDeliveryToMarkdown(
    narrativeForMerge,
    evidenceForMerge,
    input.locale,
    bookMeta,
  );

  const full_text = sanitizeDeliveryBookMarkdown(markdown, input.locale);
  timings.total_ms = Date.now() - t0;

  console.info("[delivery/report] ok", {
    timings,
    tokens_used,
    chars: full_text.length,
  });

  return { ok: true, full_text, model, tokens_used, timings };
}
