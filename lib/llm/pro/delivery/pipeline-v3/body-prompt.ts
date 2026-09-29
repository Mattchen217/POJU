/**
 * Pipeline v3 · body prompt — short, greenfield.
 * No legacy fill-prompt ban lists / soft-strip priming.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";

const BODY_SYSTEM = `你是交付报告「白话正文」写手（Pipeline v3 · 内容步①正文）。
只输出 JSON，不要 markdown。
铁律：
- 正文零命理专名（禁干支/用神/神煞/宫位专名裸报；禁括号夹注专名）。
- 用户可见扎根用语：用「能量画像」，**不用**「盘面/命盘」报幕。
- 批断只扎根论证，不是把批断译成正文（P2 例外：正文≈批断白话）。
- **P1 = 核心直答 · 一主一辅**（最佳攻坚轨 + 主路难走时的止损/备选轨）。禁止写成三块散文；禁止把 P3 科学手段清单或 P4 东方谋略段塞进 P1。
- P3 = 科学可执行策略+手段；P4 = 东方谋略三柱（局势·意象·仪轨），禁 P3 工具词族（合同/股权/律师/Excel…）换皮。
- 禁止 ⟦w:⟧/⟦t:⟧；禁止恐吓预测；禁止跨案范文照抄（冥想/深呼吸等正例动作勿当默认稿）。
质量只靠本提示与 user 真算/批断料——不要自我审查成空壳。`;

function pageDutyBlock(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return [
        `## 本页 duty · direct_answer（P1 核心直答）`,
        `- 整报告只有 **一主一辅**：primary = 最建议走的攻坚轨；backup = 主路受阻/难落地时的第二方案。`,
        `- 结构必须是：core_judgment + primary + backup（**不要** dimensions[] 散文块）。`,
        `- primary/backup 各写厚 core_logic（约 3–4 短段）：路是什么 → 为何对本案成立（白话扎根）→ 成功样貌 → 何时不能硬走/准备切辅。`,
        `- why / when 必填实质句；name 贴本案（禁 Primary path 英文占位）。`,
        `- **能量画像用语（硬）**：扎根时用「基于你的能量画像 / 你的能量画像显示…」。**禁止**写「你的盘面 / 从盘看 / 命盘显示」。定位对，用词要走能量画像。`,
        `- **可见正文零命理专名（硬）**：core_judgment / name / core_logic / why / when / strategic_goal / leverage_chip 里禁止出现干支、十神、用神、神煞、合冲刑害专名，也禁止括号夹注如「（食神）」「（午丑相害）」。结构力改写成白话（输出力、稳定安全感、合作摩擦等）。`,
        `- chart_anchors 可放闭集短标签（给下游承重，UI 不展开依据）；**不要**把专名抄进可见叙事。`,
        `- **辅路 = 决策备选轨，不是法律 SOP**：可写「降维为顾问/收费试水、先锁边界再谈合伙」等节奏选择；禁律师起草、合同条款表、股权比例模板、融资确权步骤（那是 P3）。`,
        `- 禁区：冥想调候清单；禁「东方谋略看…」另起一段（P4）；禁把「对方该怎么改」写成主路径；角色称呼须与上游一致（勿把对方的型人标签安到用户头上）。`,
      ].join("\n");
    case "foundation":
      return [
        `## 本页 duty · foundation（P2）`,
        `- 正文≈批断白话翻译；多卡表象+本质；末卡收敛到主辅为何成立。`,
        `- 用 why_cards[{title,surface,essence}]，不要随便改成 dimensions。`,
      ].join("\n");
    case "science_action":
      return `## 本页 duty · P3\n科学策略+手段；须能锚定 P1 主辅；批断只扎根。`;
    case "metaphysics_action":
      return `## 本页 duty · P4\n东方谋略三柱；禁 P3 工具换皮；禁正例动作照抄。`;
    case "risk_guard":
      return `## 本页 duty · P5\n执行坑+防法，指回上游动作。`;
    case "signals_close":
      return `## 本页 duty · P6\n今晚一事+近7日+收尾；禁四周甘特。`;
    default:
      return "";
  }
}

function pageShapeHint(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return [
        `输出形状（必须遵守字段名）：`,
        `{`,
        `  "page": "direct_answer",`,
        `  "page_title": "...",`,
        `  "page_subtitle": "点明攻坚轨 vs 止损轨",`,
        `  "core_judgment": "一句正面直答（含主辅取舍）",`,
        `  "primary": {`,
        `    "role": "primary",`,
        `    "name": "本案主路径短名",`,
        `    "core_logic": "3–4短段厚叙事（路/为何成立/成功样貌/切辅边界）",`,
        `    "why": "一句为何首选",`,
        `    "when": "一句何时适用",`,
        `    "strategic_goal": "可选",`,
        `    "leverage_chip": "可选关键筹码",`,
        `    "chart_anchors": [],`,
        `    "dims": { "body": "mid", "mind": "high", "field": "mid" }`,
        `  },`,
        `  "backup": {`,
        `    "role": "backup",`,
        `    "name": "本案辅路径短名",`,
        `    "core_logic": "3–4短段；主路难走时怎么走",`,
        `    "why": "一句为何备这条",`,
        `    "when": "一句何时切到辅",`,
        `    "chart_anchors": [],`,
        `    "dims": { "body": "mid", "mind": "mid", "field": "mid" }`,
        `  }`,
        `}`,
        `禁止输出 dimensions[] 当作 P1 正文。`,
      ].join("\n");
    case "foundation":
      return `输出：{ "page":"foundation", "page_title":"...", "page_subtitle":"...", "why_cards":[{ "title":"...", "surface":"用户可见表象", "essence":"结构本质白话（≈批断译）", "chart_anchors":[] }] }`;
    case "science_action":
      return `输出：{ "page":"science_action", "page_title":"...", "page_subtitle":"...", "primary_toolkit":{ "title":"主·科学", "angles":[{ "name":"...", "strategy":"...", "means":["..."], "chart_anchors":[] }] }, "backup_toolkit":{ "title":"辅·科学", "angles":[{ "name":"...", "strategy":"...", "means":["..."], "chart_anchors":[] }] } }`;
    case "metaphysics_action":
      return `输出：{ "page":"metaphysics_action", "page_title":"...", "page_subtitle":"...", "dimensions":[{ "name":"...", "strategy":"局势/意象主张", "means":["仪轨类动作（节奏/场域/身心类别上限）…"], "chart_anchors":[] }] }`;
    case "risk_guard":
      return `输出：{ "page":"risk_guard", "page_title":"...", "page_subtitle":"...", "red_lights":[{ "name":"...", "narrative":"..." }], "traps":[{ "name":"...", "narrative":"..." }], "switch_to_backup":{ "name":"...", "narrative":"..." }, "protection":[{ "name":"...", "narrative":"..." }] }`;
    case "signals_close":
      return `输出：{ "page":"signals_close", "page_title":"...", "page_subtitle":"...", "tonight":"...", "next_7_days":"...", "close":"..." }`;
    default:
      return `输出：{ "page":"${key}", "page_title":"...", "page_subtitle":"..." }`;
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
    pageDutyBlock(input.key),
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
