/**
 * Pipeline v3 · body_polish — 可见层读感润色（做给人读）。
 * 上游已做准；本步禁改事实/门槛/页角色；chart_anchors 代码盖回。
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_SINGLE_CALL_TIMEOUT_MS,
  PAGE_SCHEMA_FILL_MAX_TOKENS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import { coercePageSchemaLoose } from "@/lib/llm/pro/delivery/pipeline-v3/content-body";
import { buildBodyGateAvoidanceBlockForPolish } from "@/lib/llm/pro/delivery/pipeline-v3/gate-body-category";
import {
  buildLabCallTrace,
  type LabCallTrace,
} from "@/lib/llm/pro/delivery/lab/call-trace";

export type BodyPolishOk = {
  ok: true;
  page: DeliveryPageData;
  tokens_used: number;
  last_raw_text?: string;
  call_trace: LabCallTrace;
};

export type BodyPolishFail = {
  ok: false;
  reason: string;
  tokens_used: number;
  last_raw_text?: string;
  call_trace?: LabCallTrace;
};

function localeLabel(locale: string): string {
  const l = (locale || "zh").toLowerCase();
  if (l.startsWith("en")) return "English";
  if (l.startsWith("zh")) return "简体中文（大白话完整句；含中译中润色）";
  return locale;
}

function buildPolishPrompts(input: {
  key: DeliverySegmentKey;
  locale: string;
  draft: DeliveryPageData;
  /** 本步上次撞闸时回灌，便于重跑对症避开（类别尺，非本案追句）。 */
  prior_gate_fail?: { failed_rule?: string; detail?: string } | null;
}): { system: string; user: string } {
  const gateBlock = buildBodyGateAvoidanceBlockForPolish(input.key);
  const prior =
    input.prior_gate_fail?.failed_rule || input.prior_gate_fail?.detail
      ? [
          ``,
          `## 上轮润色撞闸（本步重跑 · 对症避开 · 仍写类别勿追本案二字）`,
          input.prior_gate_fail.failed_rule
            ? `- rule: ${input.prior_gate_fail.failed_rule}`
            : "",
          input.prior_gate_fail.detail
            ? `- detail: ${String(input.prior_gate_fail.detail).slice(0, 280)}`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  const system = [
    `你是交付报告「可见正文润色」编辑（Pipeline v3 · body_polish）。`,
    `只输出 JSON，不要 markdown。`,
    ``,
    `## 人设`,
    `上游已做准、做真。你负责「给人读」：语气顺、句完整、locale 对齐；并主动避开正文机闸会拦的类别。`,
    ``,
    `## 要输出`,
    `- 与输入同页 key、同字段结构的完整 JSON。`,
    `- 可见字段（title/subtitle/name/strategy/means 等）读起来像给真人的执行说明。`,
    `- 目标语言：${localeLabel(input.locale)}。`,
    ``,
    gateBlock,
    ``,
    `## 其它硬锁（非闸但仍禁）`,
    `- 禁止增删角度条数、means 条数；禁止改动作指向与收集事实（如已拒门槛、半年等时长）。`,
    `- 禁止把 chart_anchors 真词写进可见字段；chart_anchors 原样保留。`,
    `- 禁止恐吓预测；禁止自我发挥新策略；没有的事实不要补。`,
    `- 禁止把本页改成另一页角色（P3=协议/清单主语，不是气场仪轨）。`,
  ].join("\n");

  const user = [
    `## 本页 key=${input.key} locale=${input.locale}`,
    prior,
    ``,
    `## 待润色草稿（只润色可见读感；结构与事实锁定；见上机闸同尺）`,
    JSON.stringify(input.draft, null, 2),
    ``,
    `## 输出`,
    `原样形状的完整 JSON（page 字段钉死为 "${input.key}"）。自检后再交：可见层零专名、无引号台词、无 X% 占位、无编造时长、已拒路径不回主轨。`,
  ].join("\n");

  return { system, user };
}

type AngleLike = {
  name?: string;
  strategy?: string;
  means?: string[];
  chart_anchors?: string[];
};

/** 按 path 盖回 chart_anchors，防止润色枪改真词槽。 */
export function stampChartAnchorsFromDraft(
  key: DeliverySegmentKey,
  polished: DeliveryPageData,
  draft: DeliveryPageData,
): DeliveryPageData {
  if (key !== "science_action") return polished;
  const d = draft as {
    primary_toolkit?: { angles?: AngleLike[] };
    backup_toolkit?: { angles?: AngleLike[] };
  };
  const p = polished as {
    page: "science_action";
    page_title?: string;
    page_subtitle?: string;
    primary_toolkit?: { title?: string; angles?: AngleLike[] };
    backup_toolkit?: { title?: string; angles?: AngleLike[] };
  };
  const stampKit = (
    out?: { title?: string; angles?: AngleLike[] },
    src?: { angles?: AngleLike[] },
  ) => {
    if (!out?.angles?.length) return out;
    return {
      ...out,
      angles: out.angles.map((a, i) => ({
        ...a,
        chart_anchors: Array.isArray(src?.angles?.[i]?.chart_anchors)
          ? [...(src!.angles![i]!.chart_anchors as string[])]
          : a.chart_anchors ?? [],
      })),
    };
  };
  return {
    ...p,
    primary_toolkit: stampKit(p.primary_toolkit, d.primary_toolkit) as typeof p.primary_toolkit,
    backup_toolkit: stampKit(p.backup_toolkit, d.backup_toolkit) as typeof p.backup_toolkit,
  } as DeliveryPageData;
}

export async function runBodyPolishGenerate(input: {
  key: DeliverySegmentKey;
  locale: string;
  draft: DeliveryPageData;
  session_id?: string;
  timeout_ms?: number;
  signal?: AbortSignal;
  prior_gate_fail?: { failed_rule?: string; detail?: string } | null;
}): Promise<BodyPolishOk | BodyPolishFail> {
  const { system, user } = buildPolishPrompts({
    key: input.key,
    locale: input.locale,
    draft: input.draft,
    prior_gate_fail: input.prior_gate_fail,
  });

  let tokens_used = 0;
  try {
    const result = await callLLM({
      call_type: "main_delivery",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: PAGE_SCHEMA_FILL_MAX_TOKENS,
      thinking_effort: "low",
      timeout_ms: input.timeout_ms ?? DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      response_format: "json",
      session_id: input.session_id,
      temperature: 0.25,
      max_attempts: deliveryTransportMaxAttempts(),
      signal: input.signal,
      phase_name: "content_body_polish_v3",
    });
    tokens_used += result.meta.tokens_used;
    const text = result.content?.trim() ?? "";
    const baseTrace = {
      phase: "content_body_polish_v3",
      system,
      user,
      user_feed: "(draft page_schema JSON)",
      result,
    };
    if (!text) {
      return {
        ok: false,
        reason: "empty_response",
        tokens_used,
        last_raw_text: text,
        call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
      };
    }
    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      return {
        ok: false,
        reason: "json_parse_failed",
        tokens_used,
        last_raw_text: text,
        call_trace: buildLabCallTrace({ ...baseTrace, raw_text: text }),
      };
    }
    const coerced = coercePageSchemaLoose(input.key, parsed);
    if (!coerced) {
      return {
        ok: false,
        reason: "coerce_failed",
        tokens_used,
        last_raw_text: text,
        call_trace: buildLabCallTrace({
          ...baseTrace,
          raw_text: text,
          parsed,
        }),
      };
    }
    const page = stampChartAnchorsFromDraft(input.key, coerced, input.draft);
    return {
      ok: true,
      page,
      tokens_used,
      last_raw_text: text,
      call_trace: buildLabCallTrace({
        ...baseTrace,
        raw_text: text,
        parsed: page,
      }),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "llm_error";
    return { ok: false, reason: msg, tokens_used };
  }
}
