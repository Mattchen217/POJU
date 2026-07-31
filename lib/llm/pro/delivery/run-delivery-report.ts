import { callLLM } from "@/lib/llm/router";
import { runDeliveryFinalize } from "@/lib/llm/pro/delivery/finalize-call";
import {
  runDeliveryEvidence,
  runDeliveryNarrative,
} from "@/lib/llm/pro/delivery/narrative-evidence-call";
import { mergeDeliveryToMarkdown } from "@/lib/llm/pro/delivery/merge-delivery-markdown";
import { sanitizeDeliveryText } from "@/lib/llm/sanitize/compliance-terms";
import { polishDeliveryGrammar } from "@/lib/llm/sanitize/delivery-grammar-polish";
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import type { DeliveryMode } from "@/lib/poju/collection-progress";

export type DeliveryReportTimings = {
  finalize_ms?: number;
  narrative_ms?: number;
  evidence_ms?: number;
  parallel_ms?: number;
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
      stage: "finalize" | "narrative" | "evidence" | "translate";
      reason: string;
      timings: DeliveryReportTimings;
    };

/** Pipeline writes in zh; translate merged markdown for non-zh UI. */
async function translateDeliveryMarkdown(
  markdown: string,
  targetLocale: string,
  session_id?: string,
): Promise<{ text: string; tokens_used: number; model: string }> {
  if (targetLocale.startsWith("zh")) {
    return { text: markdown, tokens_used: 0, model: "" };
  }
  const system = `You translate a POJU breakthrough delivery report into the target language.
Keep markdown structure exactly: ## headings, **依据与推理:** / **Evidence & reasoning:** labels (translate the label to the target language), and ⟦t:slug|…|…⟧ markers unchanged (do not translate inside markers).
Output only the translated markdown.`;
  const user = `Target locale: ${targetLocale}\n\n---\n${markdown}`;
  const result = await callLLM({
    call_type: "main_delivery",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 12_000,
    thinking_effort: "medium",
    timeout_ms: 120_000,
    response_format: "text",
    session_id,
    temperature: 0.3,
  });
  return {
    text: result.content?.trim() || markdown,
    tokens_used: result.meta.tokens_used,
    model: result.actual_model,
  };
}

/**
 * Phase 4 orchestrator:
 * finalize (serial) → Promise.all(narrative ∥ evidence) → optional translate → merge + sanitize.
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

  const tFinalize = Date.now();
  const finalized = await runDeliveryFinalize({
    breakthrough_core: input.breakthrough_core,
    covered_agenda: input.covered_agenda,
    agent_v2: input.agent_v2,
    locale: input.locale,
    delivery_mode: input.delivery_mode,
    base_analysis: input.base_analysis,
    session_id: input.session_id,
  });
  timings.finalize_ms = Date.now() - tFinalize;

  if (!finalized.ok) {
    timings.total_ms = Date.now() - t0;
    return { ok: false, stage: "finalize", reason: finalized.reason, timings };
  }
  tokens_used += finalized.tokens_used;
  model = finalized.model || model;

  const tParallel = Date.now();
  const [narrative, evidence] = await Promise.all([
    runDeliveryNarrative(finalized.value, "zh", { session_id: input.session_id }),
    runDeliveryEvidence(finalized.value, "zh", { session_id: input.session_id }),
  ]);
  timings.parallel_ms = Date.now() - tParallel;
  timings.narrative_ms = timings.parallel_ms;
  timings.evidence_ms = timings.parallel_ms;

  if (!narrative.ok) {
    timings.total_ms = Date.now() - t0;
    return { ok: false, stage: "narrative", reason: narrative.reason, timings };
  }
  if (!evidence.ok) {
    timings.total_ms = Date.now() - t0;
    return { ok: false, stage: "evidence", reason: evidence.reason, timings };
  }
  tokens_used += narrative.tokens_used + evidence.tokens_used;

  const bookMeta = {
    original_question: input.agent_v2.original_question,
    locale: "zh",
    report_id: input.session_id ? `POJU-${input.session_id.slice(0, 8)}` : undefined,
    generated_at: new Date().toISOString(),
    base_analysis: input.base_analysis ?? null,
  };
  let markdown = mergeDeliveryToMarkdown(narrative.value, evidence.value, "zh", bookMeta);

  if (!input.locale.startsWith("zh")) {
    const tTr = Date.now();
    try {
      const tr = await translateDeliveryMarkdown(markdown, input.locale, input.session_id);
      markdown = tr.text;
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

  const polished = polishDeliveryGrammar(markdown, input.locale);
  const full_text = sanitizeDeliveryText(polished.text, input.locale);
  timings.total_ms = Date.now() - t0;

  console.info("[delivery/report] ok", {
    timings,
    tokens_used,
    chars: full_text.length,
  });

  return { ok: true, full_text, model, tokens_used, timings };
}
