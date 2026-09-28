/**
 * Pipeline v3 · body prompt — short, greenfield.
 * No legacy fill-prompt ban lists / soft-strip priming.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";

const BODY_SYSTEM = `你是交付报告「白话正文」写手（Pipeline v3 · 内容步①正文）。
只输出 JSON，不要 markdown。
铁律：
- 正文零命理专名（禁干支/用神/神煞/宫位专名裸报）。
- 批断只扎根论证，不是把批断译成正文（P2 例外：正文≈批断白话）。
- P3 = 科学可执行策略+手段；P4 = 东方谋略三柱（局势·意象·仪轨），禁 P3 工具词族（合同/股权/律师/Excel…）换皮。
- 禁止 ⟦w:⟧/⟦t:⟧；禁止恐吓预测；禁止跨案范文照抄。
质量只靠本提示与 user 真算/批断料——不要自我审查成空壳。`;

function pageShapeHint(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return `输出：{ "page":"direct_answer", "page_title":"...", "page_subtitle":"...", "core":"一句结论", "why_one_liner":"...", "dimensions":[] }`;
    case "foundation":
      return `输出：{ "page":"foundation", "page_title":"...", "page_subtitle":"...", "dimensions":[{ "title":"...", "body":"归因白话（≈批断译文）" }] }`;
    case "science_action":
      return `输出：{ "page":"science_action", "page_title":"...", "page_subtitle":"...", "dimensions":[{ "title":"...", "strategy":"...", "means":["可执行手段…"] }] }`;
    case "metaphysics_action":
      return `输出：{ "page":"metaphysics_action", "page_title":"...", "page_subtitle":"...", "dimensions":[{ "title":"...", "strategy":"局势/意象主张", "means":["仪轨类动作（节奏/场域/身心）…"] }] }`;
    case "risk_guard":
      return `输出：{ "page":"risk_guard", "page_title":"...", "page_subtitle":"...", "dimensions":[{ "title":"坑名", "body":"防法，指回上游动作" }] }`;
    case "signals_close":
      return `输出：{ "page":"signals_close", "page_title":"...", "page_subtitle":"...", "dimensions":[{ "title":"...", "body":"今晚一事/近7日/收尾" }] }`;
    default:
      return `输出：{ "page":"${key}", "page_title":"...", "page_subtitle":"...", "dimensions":[] }`;
  }
}

export function buildV3BodyPrompt(input: {
  key: DeliverySegmentKey;
  locale: string;
  core_conclusion?: string;
  judgment_lock?: string;
  user_feed: string;
}): { system: string; user: string } {
  const user = [
    `## 本页 key=${input.key} locale=${input.locale}`,
    input.core_conclusion?.trim()
      ? `## core_conclusion\n${input.core_conclusion.trim()}`
      : "",
    input.judgment_lock?.trim()
      ? `## 本页原始批断（扎根用；P2 可译；P3+ 勿整段译文成手段）\n${input.judgment_lock.trim()}`
      : "",
    input.user_feed.trim() ? `## 本案真算/菜单喂料\n${input.user_feed.trim()}` : "",
    `## JSON 形状\n${pageShapeHint(input.key)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { system: BODY_SYSTEM, user };
}

export function formatJudgmentLockForBody(
  plan: DeepEvidencePlan | null | undefined,
): string {
  if (!plan?.units?.length) return "";
  return plan.units
    .map((u, i) => {
      const claim = String(u.unit_claim ?? "").trim();
      const ev = String(u.evidence ?? "").trim();
      return `[${i}] path=${u.path}\nclaim: ${claim}\nevidence: ${ev}`;
    })
    .join("\n\n");
}
