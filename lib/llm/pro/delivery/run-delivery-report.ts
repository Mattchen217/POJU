import { callLLM } from "@/lib/llm/router";
import { runDeliveryFinalize } from "@/lib/llm/pro/delivery/finalize-call";
import {
  runDeliveryEvidence,
  runDeliveryNarrative,
} from "@/lib/llm/pro/delivery/narrative-evidence-call";
import { runMarkDeliveryEvidence } from "@/lib/llm/pro/delivery/mark-evidence-call";
import { mergeDeliveryToMarkdown } from "@/lib/llm/pro/delivery/merge-delivery-markdown";
import { sanitizeDeliveryBookMarkdown } from "@/lib/llm/pro/delivery/sanitize-delivery-book";
import { polishDeliveryGrammar } from "@/lib/llm/sanitize/delivery-grammar-polish";
import {
  DELIVERY_SEGMENT_KEYS,
  type DeliveryArgumentTree,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_WRITE_MAX_TOKENS } from "@/lib/llm/pro/delivery/delivery-tasks";
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

/** Translate narrative argument bodies only (evidence already 意译+marked for foreign). */
async function translateNarrativeTree(
  tree: DeliveryArgumentTree,
  targetLocale: string,
  session_id?: string,
): Promise<{ tree: DeliveryArgumentTree; tokens_used: number; model: string }> {
  if (targetLocale.startsWith("zh")) {
    return { tree, tokens_used: 0, model: "" };
  }

  const payload: Record<string, { arguments: Array<{ body: string }> }> = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const args = tree[k];
    if (!args?.length) continue;
    payload[k] = { arguments: args.map((a) => ({ body: a.body })) };
  }

  const system = `You translate Pivot delivery narrative bodies into the target language.
Keep markdown inside each body (###, >, -). Do not add 命理 jargon. Do not invent ⟦t: markers.
Output strict JSON with the same keys; each value is { "arguments": [ { "body": "..." } ] } matching input length.`;
  const user = `Target locale: ${targetLocale}\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;

  const result = await callLLM({
    call_type: "main_delivery",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: DELIVERY_WRITE_MAX_TOKENS,
    thinking_effort: "medium",
    timeout_ms: 120_000,
    response_format: "text",
    session_id,
    temperature: 0.3,
  });

  const text = result.content?.trim() ?? "";
  let parsed: unknown = null;
  try {
    const { extractJson } = await import("@/lib/base-analysis-v2/compute/compute-call");
    parsed = extractJson(text);
  } catch {
    return { tree, tokens_used: result.meta.tokens_used, model: result.actual_model };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { tree, tokens_used: result.meta.tokens_used, model: result.actual_model };
  }

  const o = parsed as Record<string, unknown>;
  const out: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const src = tree[k] ?? [];
    if (!src.length) continue;
    const raw = o[k];
    const translatedArgs =
      raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as { arguments?: unknown }).arguments)
        ? ((raw as { arguments: unknown[] }).arguments)
        : Array.isArray(raw)
          ? raw
          : null;
    out[k] = src.map((a, i) => {
      const t = translatedArgs?.[i];
      const body =
        t && typeof t === "object" && !Array.isArray(t) && typeof (t as { body?: unknown }).body === "string"
          ? String((t as { body: string }).body).trim()
          : typeof t === "string"
            ? t.trim()
            : a.body;
      return { body: body || a.body, evidence: a.evidence };
    });
  }

  return {
    tree: out,
    tokens_used: result.meta.tokens_used,
    model: result.actual_model,
  };
}

/**
 * Phase 4 orchestrator (argument-level evidence + mark separation):
 *
 *   finalize → narrative(论点) → raw evidence(裸命理) → mark(+外文意译)
 *            → [translate narrative if !zh] → merge → sanitize
 *
 * Mark mode: DELIVERY_MARK_MODE=combined|split (default combined).
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
  if (!input.locale.startsWith("zh")) {
    const tTr = Date.now();
    try {
      const tr = await translateNarrativeTree(
        narrative.value,
        input.locale,
        input.session_id,
      );
      narrativeForMerge = tr.tree;
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
  };
  const markdown = mergeDeliveryToMarkdown(
    narrativeForMerge,
    marked.value,
    input.locale,
    bookMeta,
  );

  const polished = polishDeliveryGrammar(markdown, input.locale);
  const full_text = sanitizeDeliveryBookMarkdown(polished.text, input.locale);
  timings.total_ms = Date.now() - t0;

  console.info("[delivery/report] ok", {
    timings,
    tokens_used,
    chars: full_text.length,
  });

  return { ok: true, full_text, model, tokens_used, timings };
}
