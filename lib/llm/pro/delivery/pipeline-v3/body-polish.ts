/**
 * Pipeline v3 · body_polish — 合规加厚 + 目标语言出稿（做给人读）。
 * 上游已做准；本步禁改事实/门槛/页角色；chart_anchors **B 装配**盖回。
 * 一次 invoke = 一个 locale（zh|en|fr|es）；含中译中。
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
import type { BodyPolishLocale } from "@/lib/llm/pro/delivery/lab/types-v3";
import { isBodyPolishLocale } from "@/lib/llm/pro/delivery/lab/types-v3";

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

function normalizePolishLocale(locale: string): BodyPolishLocale {
  const l = (locale || "zh").toLowerCase().slice(0, 2);
  return isBodyPolishLocale(l) ? l : "zh";
}

function localeLabel(locale: BodyPolishLocale): string {
  switch (locale) {
    case "en":
      return "English (natural, non-robotic; keep page role)";
    case "fr":
      return "Français (naturel; garder le rôle de page)";
    case "es":
      return "Español (natural; conservar el rol de página)";
    default:
      return "简体中文（大白话完整句；中译中合规加厚）";
  }
}

function localeTaskBlock(locale: BodyPolishLocale): string {
  if (locale === "zh") {
    return [
      `## 目标语言 · zh（中译中）`,
      `- 清表面禁区并写成完整可读句；**是否加长看本页厚度合同**；不要另发明主张。`,
      `- 输出语言：简体中文。`,
    ].join("\n");
  }
  const name =
    locale === "en" ? "English" : locale === "fr" ? "French" : "Spanish";
  return [
    `## 目标语言 · ${locale}（合规 + 译出）`,
    `- 在清表面禁区的同时，把可见字段译成 **${name}**。`,
    `- 禁机器腔/直译腔；禁把东方谋略译成 HR 或合同执行腔（P4）；禁把归因页译成处方页（P2）。`,
    `- 专名仍不得进可见层（各语言同禁类别）。`,
    `- 数字/门槛/条数/动作指向与草稿一致；不要补草稿没有的事实。`,
  ].join("\n");
}

function pageRoleLock(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return "页角色锁：一主一辅取舍直答；禁改写成执行清单或气场仪轨。";
    case "foundation":
      return "页角色锁：归因译手；essence 只解释为何卡，禁怎么办收束。";
    case "science_action":
      return "页角色锁：协议/清单/里程碑主语；禁改成气场仪轨。";
    case "metaphysics_action":
      return "页角色锁：局/气/时方/结界主语；禁改成 P3 工具或职场教练腔。";
    case "risk_guard":
      return "页角色锁：护栏指回上游；禁另起第三份药方。";
    case "signals_close":
      return "页角色锁：今晚+近7日收束；禁四周甘特。";
    default:
      return "";
  }
}

function thickenContract(key: DeliverySegmentKey): string {
  switch (key) {
    case "science_action":
    case "metaphysics_action":
      return [
        `- **本页正文步故意写短** → 润色必须加厚：strategy 2–4 个完整句、相对草稿明显加长；means 扩成 1–2 个完整句。`,
        `- 禁止电报式同义改写交差。`,
        `- 不增删 angles/dimensions/means 条数；不改动作指向与事实门槛。`,
      ].join("\n");
    case "direct_answer":
      return [
        `- 正文步已要求 core_logic 四段成篇。润色默认=合规清表面 + 目标语言；**已完整则保持信息量，禁止为凑厚度灌水**。`,
        `- 仅当某段仍是电报体/半句时，才补成完整可读句。`,
        `- 不改 primary/backup 取舍轴与 when 事实方向；不发明缓冲月数。`,
      ].join("\n");
    case "foundation":
      return [
        `- 正文步已要求 essence 写成完整机制段。润色默认=合规清表面 + 目标语言；**已完整可读则保持信息量，禁止为凑厚度灌水或近义拉长**。`,
        `- 仅当某条 surface/essence 仍是半句或目录壳时，才补成完整句（essence 仍只解释为何卡、禁怎么办）。`,
        `- 不增删 why_cards 条数。`,
      ].join("\n");
    case "risk_guard":
      return [
        `- 本页产品要短而具体。润色默认=合规 + 目标语言；草稿已是完整句则保量，禁灌成执行长文。`,
        `- 仅电报体才补成完整句；不增删条数；须仍指回上游动作。`,
      ].join("\n");
    case "signals_close":
      return [
        `- 今晚/近7日/收束保持完整可读短句；草稿已完整则保量。`,
        `- 仅半句空喊才补句；禁新开四周计划。`,
      ].join("\n");
    default:
      return `- 可见字段出完整句；草稿已厚则保量，不改结构与事实。`;
  }
}

function polishSelfCheck(key: DeliverySegmentKey): string {
  if (key === "science_action" || key === "metaphysics_action") {
    return `自检：相对草稿明显加长为完整句；可见层零专名；无引号台词；无编造时长；页角色未拧；同义换词未加厚 = 废稿。`;
  }
  return `自检：合规清表面并出目标语言；草稿已完整则保持信息量、禁灌水；仅半句/电报体才补全；可见层零专名；无引号台词；无编造时长；页角色未拧。`;
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

function listDimAngles(page: DeliveryPageData | null | undefined): AngleLike[] {
  const p = page as { dimensions?: AngleLike[] } | null;
  return Array.isArray(p?.dimensions) ? p!.dimensions! : [];
}

function thickEnough(
  draft: string,
  polished: string,
  opts: { minSents: number; ratio: number; add: number; floor: number },
): boolean {
  const sents = countReadableSentences(polished);
  const dLen = compactLen(draft);
  const pLen = compactLen(polished);
  const minLen = Math.max(Math.ceil(dLen * opts.ratio), dLen + opts.add, opts.floor);
  return sents >= opts.minSents && pLen >= minLen;
}

/** 正文已写成完整可读段：润色只拦抽瘦，不逼相对加长。 */
function draftAlreadyReadable(
  draft: string,
  minSents: number,
  floor: number,
): boolean {
  return countReadableSentences(draft) >= minSents && compactLen(draft) >= floor;
}

function keepIfReadyOrGrow(
  draft: string,
  polished: string,
  opts: {
    minSents: number;
    ratio: number;
    add: number;
    floor: number;
    maxShrink?: number;
  },
): boolean {
  if (draftAlreadyReadable(draft, opts.minSents, opts.floor)) {
    const dLen = compactLen(draft);
    const pLen = compactLen(polished);
    const sents = countReadableSentences(polished);
    const floorKeep = Math.max(
      Math.min(opts.floor, dLen),
      Math.floor(dLen * (opts.maxShrink ?? 0.85)),
    );
    return sents >= opts.minSents && pLen >= floorKeep;
  }
  return thickEnough(draft, polished, opts);
}

function p5Narratives(page: DeliveryPageData | null | undefined): string[] {
  const p = page as {
    red_lights?: Array<{ narrative?: string }>;
    traps?: Array<{ narrative?: string }>;
    switch_to_backup?: { narrative?: string };
    protection?: Array<{ narrative?: string }>;
  } | null;
  return [
    ...(p?.red_lights ?? []).map((x) => String(x?.narrative ?? "")),
    ...(p?.traps ?? []).map((x) => String(x?.narrative ?? "")),
    String(p?.switch_to_backup?.narrative ?? ""),
    ...(p?.protection ?? []).map((x) => String(x?.narrative ?? "")),
  ];
}

/**
 * 润色厚度闸：按页量尺，不统一灌水。
 * P3/P4 正文故意写短 → 相对加长；P1/P2/P5/P6 草稿已完整可读 → 保量（拦抽瘦/半句未补）。
 */
export function gateBodyPolishThickness(input: {
  key: DeliverySegmentKey;
  draft: DeliveryPageData;
  polished: DeliveryPageData;
}): ContentGateVerdict | null {
  const notes: string[] = [];
  const fail = (more: string[]) =>
    more.length
      ? ({
          passed: false as const,
          failed_rule: "gate_polish_thin_synonym",
          detail:
            input.key === "science_action" || input.key === "metaphysics_action"
              ? "润色过薄：仍是同义换词/单句骨架。须明显加长为完整可读句；禁只改个别词交差——回改后重跑（不覆盖已过闸正文）。"
              : "润色抽瘦或仍是半句骨架。草稿已完整可读则保持信息量；仅电报体才补句——回改后重跑（不覆盖已过闸正文）。",
          notes: more.slice(0, 8),
        } satisfies ContentGateVerdict)
      : null;

  if (input.key === "science_action" || input.key === "metaphysics_action") {
    const draftAngles =
      input.key === "science_action"
        ? listToolkitAngles(input.draft)
        : listDimAngles(input.draft);
    const polishedAngles =
      input.key === "science_action"
        ? listToolkitAngles(input.polished)
        : listDimAngles(input.polished);
    for (let i = 0; i < polishedAngles.length; i++) {
      const d = draftAngles[i];
      const p = polishedAngles[i];
      if (!p) continue;
      if (
        !thickEnough(String(d?.strategy ?? ""), String(p.strategy ?? ""), {
          minSents: 2,
          ratio: 1.25,
          add: 24,
          floor: 40,
        })
      ) {
        notes.push(`strategy[${i}]`);
      }
      const dMeans = d?.means ?? [];
      const pMeans = p.means ?? [];
      for (let j = 0; j < pMeans.length; j++) {
        if (
          !thickEnough(String(dMeans[j] ?? ""), String(pMeans[j] ?? ""), {
            minSents: 1,
            ratio: 1.15,
            add: 8,
            floor: 20,
          })
        ) {
          notes.push(`means[${i}.${j}]`);
        }
      }
    }
    return fail(notes);
  }

  if (input.key === "direct_answer") {
    const d = input.draft as {
      primary?: { core_logic?: string };
      backup?: { core_logic?: string };
    };
    const p = input.polished as {
      primary?: { core_logic?: string };
      backup?: { core_logic?: string };
    };
    for (const slot of ["primary", "backup"] as const) {
      if (
        !keepIfReadyOrGrow(
          String(d[slot]?.core_logic ?? ""),
          String(p[slot]?.core_logic ?? ""),
          { minSents: 3, ratio: 1.15, add: 40, floor: 200 },
        )
      ) {
        notes.push(`core_logic.${slot}`);
      }
    }
    return fail(notes);
  }

  if (input.key === "foundation") {
    const dCards =
      (input.draft as { why_cards?: Array<{ essence?: string; surface?: string }> })
        .why_cards ?? [];
    const pCards =
      (
        input.polished as {
          why_cards?: Array<{ essence?: string; surface?: string }>;
        }
      ).why_cards ?? [];
    for (let i = 0; i < pCards.length; i++) {
      if (
        !keepIfReadyOrGrow(
          String(dCards[i]?.essence ?? ""),
          String(pCards[i]?.essence ?? ""),
          { minSents: 2, ratio: 1.15, add: 20, floor: 80 },
        )
      ) {
        notes.push(`essence[${i}]`);
      }
    }
    return fail(notes);
  }

  if (input.key === "risk_guard") {
    const dN = p5Narratives(input.draft);
    const pN = p5Narratives(input.polished);
    for (let i = 0; i < pN.length; i++) {
      if (
        !keepIfReadyOrGrow(dN[i] ?? "", pN[i] ?? "", {
          minSents: 1,
          ratio: 1.12,
          add: 8,
          floor: 24,
        })
      ) {
        notes.push(`narrative[${i}]`);
      }
    }
    return fail(notes);
  }

  if (input.key === "signals_close") {
    const d = input.draft as {
      tonight?: string;
      next_7_days?: string;
      close?: string;
    };
    const p = input.polished as {
      tonight?: string;
      next_7_days?: string;
      close?: string;
    };
    for (const slot of ["tonight", "next_7_days", "close"] as const) {
      if (
        !keepIfReadyOrGrow(String(d[slot] ?? ""), String(p[slot] ?? ""), {
          minSents: 1,
          ratio: 1.12,
          add: 8,
          floor: 24,
        })
      ) {
        notes.push(slot);
      }
    }
    return fail(notes);
  }

  return fail(notes);
}

function buildPolishPrompts(input: {
  key: DeliverySegmentKey;
  locale: BodyPolishLocale;
  draft: DeliveryPageData;
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
          input.key !== "science_action" &&
          input.key !== "metaphysics_action" &&
          input.prior_gate_fail.failed_rule === "gate_polish_thin_synonym"
            ? `- detail: 上轮厚度尺已按页更正。本页草稿已完整则保量，禁止为旧「须加长」指令灌水；按现行厚度合同清表面并出目标语言。`
            : input.prior_gate_fail.detail
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
    `上游只做准、做真。你负责「给人读」：**按页厚度合同 + 清表面禁区 + 目标语言出稿**。任务单一：不要改主张。`,
    ``,
    `## 换壳同禁`,
    `禁区按类别；近义/半否定/换道具仍算犯。`,
    ``,
    pageRoleLock(input.key),
    ``,
    `## 厚度合同（按页 · 非六页统一灌水）`,
    `- 与输入同页 key、同字段结构的完整 JSON。`,
    thickenContract(input.key),
    `- 读起来像给真人的说明；目标语言：${localeLabel(input.locale)}。`,
    `- 机检：P3/P4 拦过薄同义换词；其它页拦抽瘦或半句未补 → \`gate_polish_thin_synonym\`。`,
    ``,
    localeTaskBlock(input.locale),
    ``,
    gateBlock,
    ``,
    `## 其它硬锁`,
    `- 禁止为写厚而发明截止点/人数配额/未收集比例；时长只保留收集已给量。`,
    `- 禁止把 chart_anchors 真词写进可见字段；chart_anchors 原样保留。`,
    `- 禁止恐吓预测；禁止自我发挥新策略；没有的事实不要补。`,
    `- 禁可照念对话引号；举例禁用模糊词时不要加引号。`,
  ].join("\n");

  const user = [
    `## 本页 key=${input.key} target_locale=${input.locale}`,
    prior,
    ``,
    `## 待润色草稿（中文真准骨架；按本页厚度合同合规出目标语言；结构与事实锁定）`,
    JSON.stringify(input.draft, null, 2),
    ``,
    `## 输出`,
    `原样形状的完整 JSON（page 字段钉死为 "${input.key}"；可见字段语言=${input.locale}）。`,
    polishSelfCheck(input.key),
  ].join("\n");

  return { system, user };
}

function stampAnchorsArray(
  out?: string[],
  src?: string[],
): string[] | undefined {
  if (Array.isArray(src)) return [...src];
  return out;
}

/** 按 path 盖回 chart_anchors，防止润色枪改真词槽。 */
export function stampChartAnchorsFromDraft(
  key: DeliverySegmentKey,
  polished: DeliveryPageData,
  draft: DeliveryPageData,
): DeliveryPageData {
  if (key === "science_action") {
    const d = draft as {
      primary_toolkit?: { angles?: AngleLike[] };
      backup_toolkit?: { angles?: AngleLike[] };
    };
    const p = polished as {
      page: "science_action";
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
          chart_anchors: stampAnchorsArray(
            a.chart_anchors,
            src?.angles?.[i]?.chart_anchors,
          ),
        })),
      };
    };
    return {
      ...p,
      primary_toolkit: stampKit(p.primary_toolkit, d.primary_toolkit) as typeof p.primary_toolkit,
      backup_toolkit: stampKit(p.backup_toolkit, d.backup_toolkit) as typeof p.backup_toolkit,
    } as DeliveryPageData;
  }

  if (key === "metaphysics_action") {
    const d = draft as { dimensions?: AngleLike[] };
    const p = polished as { dimensions?: AngleLike[] };
    if (!Array.isArray(p.dimensions)) return polished;
    return {
      ...p,
      dimensions: p.dimensions.map((a, i) => ({
        ...a,
        chart_anchors: stampAnchorsArray(
          a.chart_anchors,
          d.dimensions?.[i]?.chart_anchors,
        ),
      })),
    } as DeliveryPageData;
  }

  if (key === "foundation") {
    const d = draft as {
      why_cards?: Array<{ chart_anchors?: string[] }>;
    };
    const p = polished as {
      why_cards?: Array<{ chart_anchors?: string[]; [k: string]: unknown }>;
    };
    if (!Array.isArray(p.why_cards)) return polished;
    return {
      ...p,
      why_cards: p.why_cards.map((c, i) => ({
        ...c,
        chart_anchors: stampAnchorsArray(
          c.chart_anchors,
          d.why_cards?.[i]?.chart_anchors,
        ),
      })),
    } as DeliveryPageData;
  }

  if (key === "direct_answer") {
    const d = draft as {
      primary?: { chart_anchors?: string[] };
      backup?: { chart_anchors?: string[] };
    };
    const p = polished as {
      primary?: { chart_anchors?: string[]; [k: string]: unknown };
      backup?: { chart_anchors?: string[]; [k: string]: unknown };
    };
    return {
      ...p,
      primary: p.primary
        ? {
            ...p.primary,
            chart_anchors: stampAnchorsArray(
              p.primary.chart_anchors,
              d.primary?.chart_anchors,
            ),
          }
        : p.primary,
      backup: p.backup
        ? {
            ...p.backup,
            chart_anchors: stampAnchorsArray(
              p.backup.chart_anchors,
              d.backup?.chart_anchors,
            ),
          }
        : p.backup,
    } as DeliveryPageData;
  }

  return polished;
}

export async function runBodyPolishGenerate(input: {
  key: DeliverySegmentKey;
  locale: string;
  draft: DeliveryPageData;
  session_id?: string;
  timeout_ms?: number;
  signal?: AbortSignal;
  prior_gate_fail?: { failed_rule?: string; detail?: string } | null;
  /** ≥2 after Lab transport stall → provider escape. */
  dispatch_attempt?: number;
}): Promise<BodyPolishOk | BodyPolishFail> {
  const locale = normalizePolishLocale(input.locale);
  const { system, user } = buildPolishPrompts({
    key: input.key,
    locale,
    draft: input.draft,
    prior_gate_fail: input.prior_gate_fail,
  });

  let tokens_used = 0;
  try {
    const { deliveryDispatchProviderBody } = await import(
      "@/lib/llm/pro/delivery/dispatch/provider-escape"
    );
    const provider = deliveryDispatchProviderBody(
      Math.max(1, input.dispatch_attempt ?? 1),
    );
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
      provider,
      phase_name: "content_body_polish_v3",
    });
    tokens_used += result.meta.tokens_used;
    const text = result.content?.trim() ?? "";
    const baseTrace = {
      phase: "content_body_polish_v3",
      system,
      user,
      user_feed: `(draft page_schema JSON · target_locale=${locale})`,
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
