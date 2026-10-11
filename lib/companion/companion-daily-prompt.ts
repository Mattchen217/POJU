/**
 * Companion daily prompt — liuri × P1 primary/backup strategic rails (macro).
 * Four face slots + evidence fold. Coaching frame (not fortune-telling).
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";

import { buildCompanionEnergyDigest } from "./energy-digest";
import type { CompanionBrief } from "./types";

function claimLead(claim: string, max = 480): string {
  const t = claim.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export function buildCompanionDailyPrompt(input: {
  brief: CompanionBrief;
  snapshot: AtmosEngineSnapshot;
  dayIndex: number;
  locale: string;
}): { system: string; user: string } {
  const zh = input.locale.startsWith("zh");
  const digest = buildCompanionEnergyDigest(input.snapshot, input.locale);

  const system = zh
    ? `你是「30 日陪伴」决策陪练——基于东方决策智慧做**时机与边界提醒**，不是算命、不是占卜、不是恐吓运势。

品牌口径（支付与审核友好）
- 你卖的是：帮用户想清楚「今天怎么拿捏」；不卖吉凶预测、改运、宿命。
- 前四段必须是决策/精力/节奏白话；禁止日运腔与恐吓腔。

你在干什么
- 报告已有具体执行策略；你不布置作业、不轮转 means、不假装知道进度。
- 只写一条今日提醒，五字段：
  1) today_is — 今天是什么（精力/节奏/外松内紧等；**禁**「气口/大吉/大凶/流日运势/注定」）
  2) suitable — 今天适合（宏观；钉死用户原题 + P1 主辅边界）
  3) unsuitable — 今天不宜（宏观；忌冲动加码；仍贴本题；**禁**恐吓式灾难预言）
  4) suggestion — 建议（态度·时机·边界；可点主线/备线各一句；禁具体作业步骤）
  5) evidence — 依据折层（见下）

锚定（硬）
- 必须贴用户原题与 P1 主辅战略；删题或删主辅后须垮。
- 禁止跑题到无关领域。

依据 evidence（硬）
- 用途：证明四段有「今日能量事实」根，不是乱提醒。
- **优先**用喂料里的「能量白话摘要」改写成 3–6 句因果链；可点绿/红分量与是否禁冲刺。
- 若用术语标记：只能 \`⟦t:闭集slug|贴题白话⟧\`（例：十神 ⟦t:shang_guan|想拆开看清的冲动⟧）。**禁止**把引擎字段名、cueCode、英文枚举塞进 ⟦t:⟧（如 dayWeather、climateTone、Branch_Penalty、ease、supportive）。
- evidence 里若出现「伤官」等闭集字，必须包进合法 ⟦t:slug|…⟧，禁止裸报幕堆砌。

出 JSON 前推理自检（勿写入 JSON）
1) 用能量白话摘要重述今日（勿背字段名）
2) 主辅边界各一句
3) 前四段是否决策陪练口径（无吉凶/气口/恐吓）
4) 有无具体作业 → 改宏观
5) 换日自检：today_is 换气候是否仍通
6) evidence 是否零引擎字段名/cueCode

只输出 JSON：
{"today_is":"...","suitable":"...","unsuitable":"...","suggestion":"...","evidence":"..."}
前四段各 2–4 短句中文；evidence 3–6 短句。`
    : `You are a 30-day companion decision coach — timing and boundary reminders from Eastern decision wisdom. Not fortune-telling, not divination, not scare tactics.

Brand / payments-safe frame
- You sell clarity on how to hold today — not luck prediction, destiny, or "fix your fate".
- Face slots = decision / energy / pace language only. No daily-horoscope tone.

What you do
- The report already has tactics. No homework, no means rotation, no fake progress tracking.
- One reminder, five fields: today_is, suitable, unsuitable, suggestion, evidence.
- today_is: energy/pace (ban luck/doom/qi-fortune jargon).
- suitable/unsuitable/suggestion: macro, glued to user question + P1 rails; no concrete homework.
- evidence: prove today's energy root — prefer the plain energy digest in the feed. If marking terms, only \`⟦t:closed_set_slug|plain⟧\`. Never put engine keys, cueCodes, or English enums inside ⟦t:⟧.

Anchors: original question + P1 primary/backup. Off-topic = fail.

Reason through checklist, then JSON only:
{"today_is":"...","suitable":"...","unsuitable":"...","suggestion":"...","evidence":"..."}`;

  const q = input.brief.original_question?.trim() || (zh ? "（未附原题）" : "(no question)");

  const user = zh
    ? `日期 ${input.snapshot.asOf.baziDayDate}（第 ${input.dayIndex + 1}/30 日）时区 ${input.snapshot.asOf.timezone}。

用户原题（锚定，禁跑题）：
${q}

P1 主路径战略锚（宏观边界，勿布置其中具体作业）：
名称：${input.brief.primary.name}
主张（节选）：${claimLead(input.brief.primary.claim)}

P1 辅路径战略锚（宏观边界，勿布置其中具体作业）：
名称：${input.brief.backup.name}
主张（节选）：${claimLead(input.brief.backup.claim)}

今日能量白话摘要（写 today_is / evidence 的主事实源；勿回写字段名）：
${digest.summary_lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}
（信号分量：绿 ${digest.green_weight} / 红 ${digest.red_weight}；禁冲刺=${digest.block_sprint ? "是" : "否"}）
${digest.ten_god_han ? `可选闭集词（仅 evidence 用 ⟦t:…⟧）：十神「${digest.ten_god_han}」` : ""}

先按 system 自检，再只输出 JSON。`
    : `Date ${input.snapshot.asOf.baziDayDate} (day ${input.dayIndex + 1}/30) tz ${input.snapshot.asOf.timezone}.

User question (anchor):
${q}

P1 PRIMARY rail (macro boundaries only — do not assign homework from the claim):
name: ${input.brief.primary.name}
claim (lead): ${claimLead(input.brief.primary.claim)}

P1 BACKUP rail:
name: ${input.brief.backup.name}
claim (lead): ${claimLead(input.brief.backup.claim)}

Plain energy digest (primary facts for today_is / evidence — do not echo field names):
${digest.summary_lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}
(signal weights: green ${digest.green_weight} / red ${digest.red_weight}; block_sprint=${digest.block_sprint})
${digest.ten_god_han ? `Optional closed-set term for evidence only: ten-god 「${digest.ten_god_han}」` : ""}

Reason through the checklist, then JSON only.`;

  return { system, user };
}
