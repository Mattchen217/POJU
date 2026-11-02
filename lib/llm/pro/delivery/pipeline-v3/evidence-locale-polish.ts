/**
 * Evidence soft stage 3 — model locale polish over code-marked ⟦t:⟧ text.
 *
 * AFTER prepareTextForGlossaryRender, BEFORE toSoftTranslatedPlainText.
 * Preserves every ⟦t:…⟧ marker byte-identical; rewrites only connective vernacular
 * into the delivery locale (zh also invokes LLM — no silent identity).
 */

import { callLLM, type CallLLMResult } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type {
  DeliveryArgument,
  DeliveryArgumentTree,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_MARK_MAX_TOKENS,
  DELIVERY_MARK_TIMEOUT_MS,
  resolveDeliveryMarkEffort,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { TERM_MARKER_PATTERN } from "@/lib/llm/sanitize/term-marking";

export type EvidenceLocalePolishMode = "llm" | "skipped";

export type EvidenceLocalePolishMeta = {
  mode: EvidenceLocalePolishMode;
  actual_model?: string;
  tokens_used: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  usage_written?: boolean;
  finish_reason?: string | null;
  generation_id?: string | null;
  latency_ms?: number;
  thinking_effort?: string;
};

export type EvidenceLocalePolishLlmResult =
  | {
      ok: true;
      content: string;
      tokens_used: number;
      result?: Pick<CallLLMResult, "reasoning" | "reasoning_details" | "actual_model" | "meta">;
    }
  | {
      ok: false;
      reason: string;
      tokens_used: number;
      result?: Pick<CallLLMResult, "reasoning" | "reasoning_details" | "actual_model" | "meta">;
      raw_text?: string;
    };

/** Injectable LLM for Lab tests (no network). */
export type EvidenceLocalePolishLlm = (input: {
  system: string;
  user: string;
  locale: string;
  session_id?: string;
  timeout_ms?: number;
}) => Promise<EvidenceLocalePolishLlmResult>;

const TERM_MARKER_RE = /⟦t:[^⟧]*⟧/g;

export function listTermMarkers(text: string): string[] {
  const out: string[] = [];
  TERM_MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(TERM_MARKER_RE.source, "g");
  while ((m = re.exec(text ?? "")) !== null) out.push(m[0]);
  return out;
}

export function markersPreserved(input: string, output: string): boolean {
  const a = listTermMarkers(input);
  const b = listTermMarkers(output);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function localeLabel(locale: string): string {
  const l = locale.trim().toLowerCase().slice(0, 2);
  switch (l) {
    case "en":
      return "US English";
    case "es":
      return "US/LatAm Spanish";
    case "fr":
      return "French";
    default:
      return "简体中文";
  }
}

function isZh(locale: string): boolean {
  return locale.trim().toLowerCase().startsWith("zh");
}

export function buildEvidenceLocalePolishPrompt(input: {
  locale: string;
  args: Array<{ evidence: string; body?: string }>;
}): { system: string; user: string } {
  const locale = input.locale.trim() || "zh";
  const lang = localeLabel(locale);
  const zh = isZh(locale);

  const system = zh
    ? [
        `# 你是谁`,
        `你是「依据多语润色」编辑（evidence locale_polish）。`,
        `输入已经是代码打标后的依据：关键术语已包在 \`⟦t:slug|…⟧\` 里。`,
        `你的唯一工作：把标记**之间**的连接白话润成母语读者一口气能读懂的句子（中→中）。`,
        ``,
        `# 铁律（标记碰不得）`,
        `1. 每个 \`⟦t:…⟧\` 从左 ⟦ 到右 ⟧ **整段一字不改**（不增不删不改 slug / 竖线内容）。`,
        `2. 输入有几个标记，输出必须有几个、顺序相同；禁止多造、合并、拆开。`,
        `3. 只改标记外侧的连接白话；禁止把标记里的专名再抄到外面。`,
        `4. 禁止发明人生建议 / 改主张；body 只供理解，不要抄进 evidence。`,
        ``,
        `# 交卷`,
        `只输出一个 JSON：{"arguments":[{"evidence":"..."},...]}`,
        `条数与顺序同输入；每条只填 evidence。`,
      ].join("\n")
    : [
        `# Who you are`,
        `You are the evidence locale_polish editor for delivery locale **${lang}** (${locale}).`,
        `Input evidence is already code-marked: load-bearing terms sit inside \`⟦t:slug|…⟧\` markers.`,
        `Your only job: rewrite the connective **between** markers into clear spoken ${lang} a high-school reader can follow.`,
        ``,
        `# Hard rules (markers untouchable)`,
        `1. Keep every \`⟦t:…⟧\` byte-identical from left ⟦ through right ⟧ (no slug / pipe edits).`,
        `2. Same marker count and order as input — never invent, drop, merge, or split markers.`,
        `3. Edit only connective outside markers; do not restate marker interiors as plain subjects.`,
        `4. Do not invent life advice or rewrite the claim; body is context only — never copy it into evidence.`,
        ``,
        `# Output`,
        `Emit only one JSON object: {"arguments":[{"evidence":"..."},...]}`,
        `Same length/order as input; each object has evidence only.`,
      ].join("\n");

  const payload = {
    arguments: input.args.map((a) => ({
      ...(a.body?.trim() ? { body: a.body.trim() } : {}),
      evidence: a.evidence,
    })),
  };

  const user = zh
    ? [
        `请润色下列依据连接白话；保留全部 \`⟦t:…⟧\`。`,
        `最终只输出 JSON。`,
        "```json",
        JSON.stringify(payload, null, 2),
        "```",
      ].join("\n")
    : [
        `Polish connective vernacular into ${lang}; keep every \`⟦t:…⟧\` unchanged.`,
        `Emit JSON only.`,
        "```json",
        JSON.stringify(payload, null, 2),
        "```",
      ].join("\n");

  return { system, user };
}

function coerceEvidenceArgs(
  parsed: unknown,
  expected: number,
): string[] | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const args = Array.isArray(parsed)
    ? parsed
    : Array.isArray(o.arguments)
      ? o.arguments
      : null;
  if (!args || args.length !== expected) return null;
  const out: string[] = [];
  for (const a of args) {
    if (!a || typeof a !== "object") return null;
    const ev = (a as { evidence?: unknown }).evidence;
    if (typeof ev !== "string") return null;
    out.push(ev);
  }
  return out;
}

export async function defaultEvidenceLocalePolishLlm(input: {
  system: string;
  user: string;
  locale: string;
  session_id?: string;
  timeout_ms?: number;
}): Promise<EvidenceLocalePolishLlmResult> {
  void input.locale;
  try {
    const result = await callLLM({
      call_type: "main_delivery",
      system: input.system,
      messages: [{ role: "user", content: input.user }],
      max_tokens: DELIVERY_MARK_MAX_TOKENS,
      thinking_effort: resolveDeliveryMarkEffort(),
      timeout_ms: input.timeout_ms ?? DELIVERY_MARK_TIMEOUT_MS,
      response_format: "text",
      session_id: input.session_id,
      temperature: 0.3,
      max_attempts: 1,
    });
    const text = result.content?.trim() ?? "";
    const tokens_used = result.meta.tokens_used ?? 0;
    const slice = {
      reasoning: result.reasoning,
      reasoning_details: result.reasoning_details,
      actual_model: result.actual_model,
      meta: result.meta,
    };
    if (!text) {
      return { ok: false, reason: "locale_polish_empty", tokens_used, result: slice, raw_text: text };
    }
    return { ok: true, content: text, tokens_used, result: slice };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `locale_polish_llm:${reason}`, tokens_used: 0 };
  }
}

/**
 * Mock-friendly helper: slightly thicken connective while keeping markers.
 * Used by unit tests — not production.
 */
export function mockPolishMarkedEvidenceKeepMarkers(text: string, locale: string): string {
  const markers = listTermMarkers(text);
  if (!markers.length) {
    const tag = isZh(locale) ? "（润色）" : " (polished)";
    return `${text.trim()}${tag}`;
  }
  // Split on markers, polish gaps only.
  const parts = text.split(/(⟦t:[^⟧]*⟧)/g);
  return parts
    .map((p) => {
      if (p.startsWith("⟦t:") && p.endsWith("⟧")) return p;
      const t = p.trim();
      if (!t) return p;
      if (isZh(locale)) {
        // Light zh connective touch so Lab can see polish ≠ mark.
        if (t.includes("以及") && !t.includes("接着")) return p.replace("以及", "接着还有");
        if (!t.includes("一眼能懂")) return `${p}`.replace(/。?\s*$/, "，让人一眼能懂。");
        return p;
      }
      if (!/\bthen\b/i.test(t) && /,\s*|和|以及/.test(t)) {
        return p.replace(/以及|,/, " then ");
      }
      if (!/\(polished connective\)/i.test(t)) {
        return `${p.trimEnd()} (polished connective) `;
      }
      return p;
    })
    .join("");
}

export async function runEvidenceLocalePolish(input: {
  key: DeliverySegmentKey;
  marked: DeliveryArgumentTree;
  locale: string;
  session_id?: string;
  timeout_ms?: number;
  skip?: boolean;
  llm?: EvidenceLocalePolishLlm;
}): Promise<
  | {
      ok: true;
      locale_polish: DeliveryArgumentTree;
      meta: EvidenceLocalePolishMeta;
      notes: string[];
      llm_result?: Pick<CallLLMResult, "reasoning" | "reasoning_details" | "actual_model" | "meta">;
      system?: string;
      user?: string;
      raw_text?: string;
    }
  | {
      ok: false;
      reason: string;
      tokens_used: number;
      notes: string[];
      meta: EvidenceLocalePolishMeta;
      llm_result?: Pick<CallLLMResult, "reasoning" | "reasoning_details" | "actual_model" | "meta">;
      system?: string;
      user?: string;
      raw_text?: string;
      locale_polish?: DeliveryArgumentTree;
    }
> {
  const locale = input.locale.trim() || "zh";
  const srcArgs = input.marked[input.key] ?? [];
  const work = srcArgs
    .map((a, i) => ({
      index: i,
      body: a.body,
      evidence: a.evidence?.trim() ?? "",
    }))
    .filter((a) => a.evidence.length > 0);

  if (input.skip) {
    return {
      ok: true,
      locale_polish: structuredClone(input.marked),
      meta: { mode: "skipped", tokens_used: 0, usage_written: false },
      notes: ["evidence_soft:locale_polish:skipped"],
    };
  }

  if (!work.length) {
    return {
      ok: true,
      locale_polish: structuredClone(input.marked),
      meta: { mode: "llm", tokens_used: 0, usage_written: false },
      notes: ["evidence_soft:locale_polish:noop_empty"],
    };
  }

  const { system, user } = buildEvidenceLocalePolishPrompt({
    locale,
    args: work.map((w) => ({ evidence: w.evidence, body: w.body })),
  });

  const llm = input.llm ?? defaultEvidenceLocalePolishLlm;
  const called = await llm({
    system,
    user,
    locale,
    session_id: input.session_id,
    timeout_ms: input.timeout_ms,
  });

  if (!called.ok) {
    return {
      ok: false,
      reason: called.reason,
      tokens_used: called.tokens_used,
      notes: ["evidence_soft:locale_polish:llm_fail"],
      meta: {
        mode: "llm",
        tokens_used: called.tokens_used,
        actual_model: called.result?.actual_model,
        prompt_tokens: called.result?.meta.prompt_tokens,
        completion_tokens: called.result?.meta.completion_tokens,
        usage_written: called.result?.meta.usage_written,
        finish_reason: called.result?.meta.finish_reason ?? null,
        generation_id: called.result?.meta.generation_id ?? null,
        latency_ms: called.result?.meta.latency_ms,
        thinking_effort: called.result?.meta.thinking_effort,
      },
      llm_result: called.result,
      system,
      user,
      raw_text: called.raw_text,
    };
  }

  let parsed: unknown;
  try {
    parsed = extractJson(called.content);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      reason: `locale_polish_json:${reason}`,
      tokens_used: called.tokens_used,
      notes: ["evidence_soft:locale_polish:bad_json"],
      meta: {
        mode: "llm",
        tokens_used: called.tokens_used,
        actual_model: called.result?.actual_model,
        prompt_tokens: called.result?.meta.prompt_tokens,
        completion_tokens: called.result?.meta.completion_tokens,
        usage_written: called.result?.meta.usage_written,
        finish_reason: called.result?.meta.finish_reason ?? null,
        generation_id: called.result?.meta.generation_id ?? null,
        latency_ms: called.result?.meta.latency_ms,
        thinking_effort: called.result?.meta.thinking_effort,
      },
      llm_result: called.result,
      system,
      user,
      raw_text: called.content,
    };
  }

  const polishedList = coerceEvidenceArgs(parsed, work.length);
  if (!polishedList) {
    return {
      ok: false,
      reason: "locale_polish_shape",
      tokens_used: called.tokens_used,
      notes: ["evidence_soft:locale_polish:bad_shape"],
      meta: {
        mode: "llm",
        tokens_used: called.tokens_used,
        actual_model: called.result?.actual_model,
        usage_written: called.result?.meta.usage_written,
      },
      llm_result: called.result,
      system,
      user,
      raw_text: called.content,
    };
  }

  for (let i = 0; i < work.length; i++) {
    if (!markersPreserved(work[i]!.evidence, polishedList[i]!)) {
      return {
        ok: false,
        reason: "locale_polish_markers_mutated",
        tokens_used: called.tokens_used,
        notes: ["evidence_soft:locale_polish:markers_mutated"],
        meta: {
          mode: "llm",
          tokens_used: called.tokens_used,
          actual_model: called.result?.actual_model,
          usage_written: called.result?.meta.usage_written,
        },
        llm_result: called.result,
        system,
        user,
        raw_text: called.content,
      };
    }
  }

  const outArgs: DeliveryArgument[] = srcArgs.map((a) => ({ ...a }));
  work.forEach((w, i) => {
    outArgs[w.index] = {
      ...outArgs[w.index]!,
      evidence: polishedList[i],
    };
  });

  const locale_polish: DeliveryArgumentTree = {
    ...structuredClone(input.marked),
    [input.key]: outArgs,
  };

  // Silence unused import warning if TERM_MARKER_PATTERN only used via re-export intent
  void TERM_MARKER_PATTERN;

  return {
    ok: true,
    locale_polish,
    meta: {
      mode: "llm",
      tokens_used: called.tokens_used,
      actual_model: called.result?.actual_model,
      prompt_tokens: called.result?.meta.prompt_tokens,
      completion_tokens: called.result?.meta.completion_tokens,
      usage_written: called.result?.meta.usage_written,
      finish_reason: called.result?.meta.finish_reason ?? null,
      generation_id: called.result?.meta.generation_id ?? null,
      latency_ms: called.result?.meta.latency_ms,
      thinking_effort: called.result?.meta.thinking_effort,
    },
    notes: ["evidence_soft:locale_polish:llm"],
    llm_result: called.result,
    system,
    user,
    raw_text: called.content,
  };
}
