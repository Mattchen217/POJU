/**
 * Pipeline v3 · body prompt — short, greenfield.
 * No legacy fill-prompt ban lists / soft-strip priming.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";

const BODY_SYSTEM = `你是交付报告「白话正文」写手（Pipeline v3 · 内容步①正文）。
只输出 JSON，不要 markdown。

## 双层分工（铁律）
- **可见正文** = 行为/精力/节奏白话 +「能量画像」依据感；结构力必须映射后再写。
- **批断 / 依据折层 / chart_anchors** = 可含闭集命理真词；**禁止**把这些真词原样粘进可见正文。

## 可见正文 · 专名禁区（按类别 · 换盘仍成立）
禁止出现下列**整类**（含半白话夹带「X为忌/用」「某干支流年克…」）：
1. 十神原名族
2. 干支连写 / 天干+五行报幕
3. 用神·喜神·忌神报幕
4. 大运/流年/流月 + 干支或十神报幕
5. 合冲刑害合局等关系专名
6. 神煞原名；奇门门/星/宫原名
7. 「命盘 / 盘面 / 八字」报幕（改用「能量画像」）

自检：删掉一切专名后，结论是否仍可读且仍锚本案？若只剩空壳或必须靠专名才能懂 → 用精力/节奏白话重写。

## 其它铁律
- 批断只扎根论证，不是把批断译成正文（P2 例外：正文≈批断白话，但仍零专名）。
- **P1 = 核心直答 · 一主一辅**。禁止三块散文；禁止把 P3 手段清单或 P4 谋略段塞进 P1。
- P3 = 科学可执行；P4 = 东方谋略三柱；禁 P3 工具词族换皮进 P4。
- 禁止 ⟦w:⟧/⟦t:⟧ 进正文；禁止恐吓预测；禁止跨案范文照抄。
质量只靠本提示与 user 真算/批断料——一次写合格，不要自我审查成空壳。`;

function pageDutyBlock(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return [
        `## 本页 duty · direct_answer（P1 核心直答）`,
        `- 整报告只有 **一主一辅**：primary = 最建议走的攻坚轨；backup = 主路受阻/难落地时的第二方案。`,
        `- 结构必须是：core_judgment + primary + backup（**不要** dimensions[] 散文块）。`,
        `- **必须先吃冻结批断（硬）**：user 里「本页原始批断」含 path=core_judgment/primary/backup。正文主辅从这三条机制长出，禁止另编与批断无关的第三套故事。`,
        `- **主辅必须真算可推（硬）**：批断 + 总纲 / Fact-pack →「此刻宜守什么、忌冒进什么、主路为何、辅路何时切」。自检：删掉批断后主辅若仍处处成立 = 废稿。`,
        `- 本页 UI **不挂**依据折层；批断只供生成与 Lab 人审。`,
        `- **core_logic 必须写厚（硬）**：primary / backup 各用空行分成 **4 短段**（合计约 380–560 字，禁一两段电报）：`,
        `  ①路是什么（角色/投入边界——叙事，不是步骤表）`,
        `  ②为何对本案成立（能量画像白话扎根；删掉后应垮）`,
        `  ③成功样貌（对方/收入/话语权上可见的变化，写具体）`,
        `  ④切辅/止损边界（何种信号下不能硬走、何时切到另一轨——写清触发条件）`,
        `- why / when 必填实质句；name 贴本案（禁 Primary path 英文占位）。`,
        `- **标题贴本案（硬）**：page_title / page_subtitle 必须含本案具体取舍（如兼职试水 vs 暂守）。**禁止**模板副题：「点明攻坚轨 vs 止损轨」「攻坚轨：…；止损轨：…」这类元说明。`,
        `- **能量画像用语（硬）**：扎根用「基于你的能量画像…」；禁「盘面/命盘/八字」报幕。`,
        `- **可见正文零专名（硬 · 类别）**：title/core_logic/why/when 等可见字段遵守 system 七类禁区；真词只留 chart_anchors 与上游批断。自检：可见字段是否仍依赖十神/用忌/岁运干支/合冲专名才能读懂？→ 是则改成精力/节奏白话。`,
        `- chart_anchors 可放闭集短标签（内部承重）；**禁止**把 anchors 原文粘进 core_logic。`,
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
        `  "page_title": "贴本案的主标题（含具体取舍，禁空泛）",`,
        `  "page_subtitle": "贴本案的副题（写清主轨名 vs 辅轨名的实质对比；禁「点明攻坚轨 vs 止损轨」模板句）",`,
        `  "core_judgment": "一句正面直答（含主辅取舍）",`,
        `  "primary": {`,
        `    "role": "primary",`,
        `    "name": "本案主路径短名",`,
        `    "core_logic": "四段空行分隔：①路 ②为何成立 ③成功样貌 ④切辅边界（共约380–560字）",`,
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
        `    "core_logic": "同样四段空行分隔；写清主路失效后怎么走、成功样貌、再切入条件",`,
        `    "why": "一句为何备这条",`,
        `    "when": "一句何时切到辅",`,
        `    "chart_anchors": [],`,
        `    "dims": { "body": "mid", "mind": "mid", "field": "mid" }`,
        `  }`,
        `}`,
        `禁止输出 dimensions[] 当作 P1 正文。`,
        `自检：core_logic 若不足四段或总字数明显偏短 → 加厚③④后再交。`,
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
