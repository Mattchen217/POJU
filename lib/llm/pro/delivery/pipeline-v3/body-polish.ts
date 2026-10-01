/**
 * Pipeline v3 · body_polish — 可见层读感润色（做给人读）。
 * 上游已做准；本步禁改事实/门槛/页角色；chart_anchors **B 装配**盖回。
 * 加厚有机检：禁同义换词交差。
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
import type { ContentGateVerdict } from "@/lib/llm/pro/delivery/pipeline-v3/gate-phase-a";
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

/** 按句号/叹问号计句（类别尺 · 禁同义单句交差）。 */
export function countReadableSentences(text: string): number {
  const t = String(text ?? "").trim();
  if (!t) return 0;
  return t
    .split(/[。！？!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4).length;
}

function compactLen(text: string): number {
  return String(text ?? "").replace(/\s+/g, "").length;
}

type AngleLike = {
  name?: string;
  strategy?: string;
  means?: string[];
  chart_anchors?: string[];
};

function listToolkitAngles(page: DeliveryPageData | null | undefined): AngleLike[] {
  const p = page as {
    primary_toolkit?: { angles?: AngleLike[] };
    backup_toolkit?: { angles?: AngleLike[] };
  } | null;
  return [
    ...(p?.primary_toolkit?.angles ?? []),
    ...(p?.backup_toolkit?.angles ?? []),
  ];
}

/**
 * 润色厚度闸：strategy 须 ≥2 句且相对草稿明显加长；means 须相对草稿加长或扩到 2 句。
 * 同义换词（句数不增、字数几乎不增）= 不过。
 */
export function gateBodyPolishThickness(input: {
  key: DeliverySegmentKey;
  draft: DeliveryPageData;
  polished: DeliveryPageData;
}): ContentGateVerdict | null {
  if (input.key !== "science_action") return null;
  const draftAngles = listToolkitAngles(input.draft);
  const polishedAngles = listToolkitAngles(input.polished);
  if (polishedAngles.length === 0) return null;

  const notes: string[] = [];
  for (let i = 0; i < polishedAngles.length; i++) {
    const d = draftAngles[i];
    const p = polishedAngles[i];
    if (!p) continue;
    const dStrat = String(d?.strategy ?? "");
    const pStrat = String(p.strategy ?? "");
    const sents = countReadableSentences(pStrat);
    const dLen = compactLen(dStrat);
    const pLen = compactLen(pStrat);
    const minLen = Math.max(Math.ceil(dLen * 1.35), dLen + 28, 48);
    if (sents < 2 || pLen < minLen) {
      notes.push(`strategy[${i}] sents=${sents} len=${pLen}<${minLen}`);
    }
    const dMeans = d?.means ?? [];
    const pMeans = p.means ?? [];
    for (let j = 0; j < pMeans.length; j++) {
      const dm = String(dMeans[j] ?? "");
      const pm = String(pMeans[j] ?? "");
      const mSents = countReadableSentences(pm);
      const dmLen = compactLen(dm);
      const pmLen = compactLen(pm);
      const meanMin = Math.max(Math.ceil(dmLen * 1.2), dmLen + 10, 28);
      if (mSents < 1 || (mSents < 2 && pmLen < meanMin)) {
        notes.push(`means[${i}.${j}] sents=${mSents} len=${pmLen}<${meanMin}`);
      }
    }
  }

  if (notes.length === 0) return null;
  return {
    passed: false,
    failed_rule: "gate_p3_polish_thin_synonym",
    detail:
      "润色过薄：仍是同义换词/单句骨架。strategy 须扩成 2–4 句可读由头+打法且明显加长；每条 means 须加长或扩到 1–2 句可核对动作。禁只改个别词交差——回改后重跑（不覆盖已过闸正文）。",
    notes: notes.slice(0, 8),
  };
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
    `上游只做准、做真、可执行。你负责「给人读」：把骨架加成完整可读的执行说明；并清掉正文机闸表面类。`,
    ``,
    `## 加厚合同（硬 · 同义换词 = 不及格）`,
    `- 与输入同页 key、同字段结构的完整 JSON；不增删 angles/means 条数；不改动作指向与事实门槛。`,
    `- **strategy：必须写成 2–4 个完整句**（用句号断句）。第 1 句把本案由头说透；随后 1–2 句说清打法与为何此刻要动；可再补一句边界。字数须比草稿明显加长，禁止只改两三个近义词。`,
    `- **每条 means：扩成 1–2 个完整句**（可核对动作 + 一点怎么做/交什么）。禁止「今晚…」电报式同义改写交差。`,
    `- 读起来像给真人的执行说明；目标语言：${localeLabel(input.locale)}。`,
    `- 机检会拦：strategy 不足 2 句、或相对草稿几乎不加长 → \`gate_p3_polish_thin_synonym\`。`,
    ``,
    gateBlock,
    ``,
    `## 其它硬锁（非闸但仍禁）`,
    `- 禁止为写厚而发明截止点/人数配额/未收集比例；时长只保留收集已给量（如半年）。`,
    `- 禁止把 chart_anchors 真词写进可见字段；chart_anchors 原样保留。`,
    `- 禁止恐吓预测；禁止自我发挥新策略；没有的事实不要补。`,
    `- 禁可照念对话引号（「对方说：…」整句）；举例禁用模糊词时不要加引号，写「勿用酌情、适当一类字眼」。`,
    `- 禁止把本页改成另一页角色（P3=协议/清单主语，不是气场仪轨）。`,
  ].join("\n");

  const user = [
    `## 本页 key=${input.key} locale=${input.locale}`,
    prior,
    ``,
    `## 待润色草稿（加厚读感；结构与事实锁定；见上机闸同尺）`,
    JSON.stringify(input.draft, null, 2),
    ``,
    `## 输出`,
    `原样形状的完整 JSON（page 字段钉死为 "${input.key}"）。`,
    `自检：strategy 每条 2–4 句且明显加长；means 每条 1–2 句可读；可见层零专名、无引号台词、无 X%、无编造时长；已拒路径不回主轨。同义换词未加厚 = 废稿。`,
  ].join("\n");

  return { system, user };
}

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
      thinking_effort: "medium",
      timeout_ms: input.timeout_ms ?? DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      response_format: "json",
      session_id: input.session_id,
      temperature: 0.4,
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
