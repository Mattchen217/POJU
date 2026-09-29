/**
 * Pipeline v3 · Step1-A raw judgment — greenfield generator.
 * No assign LLM, no deep-evidence-quality gates. JSON parse + coerce only.
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_SINGLE_CALL_TIMEOUT_MS,
  PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { pageEvidenceUnitBounds } from "@/lib/llm/pro/delivery/page-schema/evidence-unit-soft-cap";

/**
 * 禁区 = 类别边界（非正例范文）。换盘后仍成立。
 * 合格自检见 pageDutyBlock。
 */
const JUDGMENT_SYSTEM = `你是交付报告「原始依据批断」写手（Pipeline v3 · 内容步①批断枪）。
只输出 JSON，不要 markdown。

## 职责（只写「为什么对此人成立」）
- unit_claim / evidence = 本盘/本局结构机制链：十神·用忌·合冲刑害·岁运姿态·宫位压力·奇门主客门等真算因果。
- 可含闭集结构真词（干支/十神/用神/宫门等）。
- calc_cite 必须能指回 user 喂料里的总纲/Fact-pack/奇门句；禁无出处现编结构。

## 禁区硬表（命中任一条 = 废稿，重写该条）
1. **手段/处方进批断**：契约/合同/股权条款怎么谈、兼职怎么开口、谈判话术、签署与否、岗位角色重构指令、清单式「该做A做B」。
2. **身心/场域动作正例**：冥想、深呼吸、独处调候、温凉饮、背靠墙、仪式动作——一律禁止出现在 claim/evidence（那是后文仪轨页的事，且禁跨案照抄）。
3. **恐吓式预测/结果承诺**：必损、必成、必然导致纠纷、吉凶时点、股权何时落地、某月必签/必不签。
4. **科学执行词族**：合同模板、律师、股权比例表、Excel、OKR——批断里禁止。
5. **⟦w:⟧ / ⟦t:⟧** 禁止。

## 允许的「节奏」说法（机制，非处方）
- 可写：岁运对用神冲突 → 冒进承压偏高；财星藏干 → 权益显性不足；官杀藏 → 制衡位弱。
- 不可写：因此现在去谈股权 / 因此先冥想再决策 / 因此不宜签最终协议。

## 页职责
- direct_answer(P1)：主辅双轨的**真算根**（宜守/忌冒进/切辅条件）；禁写成生活处方与法律步骤。
- foundation(P2)：归因机制批断（人为什么卡在这里）；禁怎么办。
- science_action(P3)：只写支撑科学执行的结构根因；不是执行本身。
- metaphysics_action(P4)：八字+奇门局势/用忌/站位机制；不是仪轨动作。
- risk_guard / signals_close：坑与窗口的结构根因；不是防法步骤表。

质量只靠本提示与 user 真算料。不要自我审查成空壳；也不要为「显得可执行」而塞手段。`;

function pageDutyBlock(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return [
        `## 本页 duty · direct_answer（P1 批断 · 主辅真算根）`,
        `- 必须恰好 3 条 units，path 固定：core_judgment / primary / backup。`,
        `- core_judgment：整案取舍的结构主张（宜什么节奏、忌什么冒进）。`,
        `- primary：为何「主轨」对本盘成立（机制链，非执行步骤）。`,
        `- backup：何时主轨失效、辅轨的结构条件（机制，非法务清单）。`,
        `- 可含闭集真词；calc_cite 指回总纲/Fact-pack。`,
        `- 禁手段/律师合同/冥想；禁必损必成。不要 means_candidate_ref。`,
        `- 本页批断供正文长主辅用；产品 UI 不挂依据折层。`,
      ].join("\n");
    case "foundation":
      return [
        `## 本页 duty · foundation（P2）`,
        `- 每条 = 一条归因机制：结构事实 → 对本题（合伙/节奏/话语权等）为何成立。`,
        `- unit_claim：一句结构主张（禁「需/应/先去…」祈使）。`,
        `- evidence：≥2 句机制链；删掉所有「去做什么」后，机制仍完整。`,
        `- 自检：若某句离开盘局换成谁都成立的鸡汤或生活处方 → 删掉重写。`,
        `- 不要输出 means_candidate_ref（本页不需要）。`,
      ].join("\n");
    case "science_action":
      return [
        `## 本页 duty · science_action（P3 批断）`,
        `- 只写结构根因，证明后文科学动作「为何必须针对此人」；禁写策略/手段本身。`,
        `- 禁合同/股权/律师等执行词进批断。`,
      ].join("\n");
    case "metaphysics_action":
      return [
        `## 本页 duty · metaphysics_action（P4 批断）`,
        `- 八字结构 + 奇门锁盘（主客/门/取向）局势链；可标 moat_class=timing|polarity|archetype。`,
        `- 禁仪轨动作、禁 P3 工具词族、禁恐吓预测时点。`,
      ].join("\n");
    case "risk_guard":
      return [
        `## 本页 duty · risk_guard（P5 批断）`,
        `- 写「哪条结构易翻车」的机制根因；禁防法步骤表。`,
      ].join("\n");
    case "signals_close":
      return [
        `## 本页 duty · signals_close（P6 批断）`,
        `- 写近窗承压/可借力的结构根因；禁日程甘特与具体执行清单。`,
      ].join("\n");
    default:
      return `## 本页 duty · ${key}\n- 纯机制批断；禁手段与预测承诺。`;
  }
}

export type ContentJudgmentOk = {
  ok: true;
  plan: DeepEvidencePlan;
  tokens_used: number;
  last_raw_text?: string;
};

export type ContentJudgmentFail = {
  ok: false;
  reason: string;
  tokens_used: number;
  last_raw_text?: string;
};

function coercePlan(
  key: DeliverySegmentKey,
  raw: unknown,
): DeepEvidencePlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const unitsRaw = Array.isArray(o.units) ? o.units : [];
  const bounds = pageEvidenceUnitBounds(key);
  const units = unitsRaw
    .map((u, i) => {
      if (!u || typeof u !== "object") return null;
      const row = u as Record<string, unknown>;
      const path = String(row.path ?? `dimensions[${i}]`).trim();
      const evidence = String(
        row.evidence ?? row.professional_evidence ?? "",
      ).trim();
      const unit_claim = String(row.unit_claim ?? row.claim ?? "").trim();
      const calc_cite = String(row.calc_cite ?? row.cite ?? "").trim();
      const moat = row.moat_class;
      const moat_class =
        moat === "timing" || moat === "polarity" || moat === "archetype"
          ? moat
          : undefined;
      if (!evidence && !unit_claim) return null;
      const meansRaw = String(row.means_candidate_ref ?? "").trim();
      // P1/P2：忽略手段标签，避免喂下游「处方」联想。
      const means_candidate_ref =
        key === "foundation" || key === "direct_answer" || !meansRaw
          ? undefined
          : meansRaw;
      return {
        path,
        evidence: evidence || unit_claim,
        unit_claim: unit_claim || evidence.slice(0, 80),
        calc_cite,
        chart_anchors: Array.isArray(row.chart_anchors)
          ? row.chart_anchors.map((a) => String(a)).filter(Boolean)
          : [],
        means_candidate_ref,
        moat_class,
      };
    })
    .filter(Boolean) as DeepEvidencePlan["units"];
  const minUnits = Math.max(1, bounds.min);
  if (units.length < minUnits) return null;
  if (key === "direct_answer") {
    const paths = new Set(units.map((u) => u.path));
    if (
      !paths.has("core_judgment") ||
      !paths.has("primary") ||
      !paths.has("backup")
    ) {
      return null;
    }
  }
  return { page: key, units };
}

function jsonShapeHint(key: DeliverySegmentKey): string {
  if (key === "direct_answer") {
    return [
      `## 输出 JSON 形状（P1：恰好 3 条）`,
      `{`,
      `  "page": "direct_answer",`,
      `  "units": [`,
      `    {`,
      `      "path": "core_judgment",`,
      `      "unit_claim": "整案取舍结构主张一句",`,
      `      "calc_cite": "总纲/Fact-pack 短摘",`,
      `      "evidence": "≥2句机制链",`,
      `      "chart_anchors": []`,
      `    },`,
      `    {`,
      `      "path": "primary",`,
      `      "unit_claim": "主轨为何对本盘成立",`,
      `      "calc_cite": "...",`,
      `      "evidence": "≥2句机制链",`,
      `      "chart_anchors": []`,
      `    },`,
      `    {`,
      `      "path": "backup",`,
      `      "unit_claim": "切辅的结构条件",`,
      `      "calc_cite": "...",`,
      `      "evidence": "≥2句机制链",`,
      `      "chart_anchors": []`,
      `    }`,
      `  ]`,
      `}`,
    ].join("\n");
  }
  const moatLine =
    key === "metaphysics_action"
      ? `      "moat_class": "timing|polarity|archetype（有则填）",`
      : "";
  const meansLine =
    key === "foundation"
      ? ""
      : `      "means_candidate_ref": "可选：回溯菜单的短结构标签（非生活处方）",`;
  return [
    `## 输出 JSON 形状`,
    `{`,
    `  "page": "${key}",`,
    `  "units": [`,
    `    {`,
    `      "path": "dimensions[0]",`,
    `      "unit_claim": "本盘结构主张一句（禁祈使/禁手段）",`,
    `      "calc_cite": "事实档短摘录（须能对上喂料）",`,
    `      "evidence": "≥2句纯机制链（禁处方、禁冥想调候、禁必损必成）",`,
    `      "chart_anchors": [],`,
    moatLine,
    meansLine,
    `    }`,
    `  ]`,
    `}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export async function runContentJudgmentGenerate(input: {
  key: DeliverySegmentKey;
  locale: string;
  session_id?: string;
  signal?: AbortSignal;
  timeout_ms?: number;
  /** Assembled fact / thesis / moat feeds (caller builds). */
  user_feed: string;
  core_conclusion?: string;
}): Promise<ContentJudgmentOk | ContentJudgmentFail> {
  const bounds = pageEvidenceUnitBounds(input.key);
  const user = [
    `## 本页 key=${input.key} locale=${input.locale}`,
    pageDutyBlock(input.key),
    input.core_conclusion?.trim()
      ? `## core_conclusion\n${input.core_conclusion.trim()}`
      : "",
    input.user_feed.trim(),
    jsonShapeHint(input.key),
    `units 条数建议 ${bounds.min}–${bounds.max}；path 用 dimensions[i]（或 angles[i]/why_cards[i] 若页习惯如此）。`,
    `落笔前自检：删光「需/应/先去/签/谈/冥想/必然」类词后，机制链是否仍成立？不成立=重写。`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let tokens_used = 0;
  try {
    const result = await callLLM({
      call_type: "main_delivery",
      system: JUDGMENT_SYSTEM,
      messages: [{ role: "user", content: user }],
      max_tokens: 12_000,
      thinking_effort: "high",
      timeout_ms:
        input.timeout_ms ??
        PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS ??
        DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      response_format: "json",
      session_id: input.session_id,
      temperature: 0.3,
      max_attempts: deliveryTransportMaxAttempts(),
      signal: input.signal,
      phase_name: "content_judgment_v3",
    });
    tokens_used += result.meta.tokens_used;
    const text = result.content?.trim() ?? "";
    if (!text) {
      return { ok: false, reason: "empty_response", tokens_used };
    }
    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      return {
        ok: false,
        reason: "json_parse_failed",
        tokens_used,
        last_raw_text: text.slice(0, 12_000),
      };
    }
    const plan = coercePlan(input.key, parsed);
    if (!plan) {
      return {
        ok: false,
        reason: "coerce_failed",
        tokens_used,
        last_raw_text: text.slice(0, 12_000),
      };
    }
    return {
      ok: true,
      plan,
      tokens_used,
      last_raw_text: text.slice(0, 12_000),
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "llm_error",
      tokens_used,
    };
  }
}
