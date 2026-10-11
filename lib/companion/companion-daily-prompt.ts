/**
 * Companion daily prompt — liuri × P1 primary/backup strategic rails (macro).
 * Four face slots + evidence fold. No P3 means rotation.
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";

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

  const lean = {
    asOf: input.snapshot.asOf,
    cycles: {
      liuri: input.snapshot.cycles.liuri.ganzhi,
      liuyue: input.snapshot.cycles.liuyue.ganzhi,
    },
    dayMaster: {
      strength: input.snapshot.dayMaster.strength,
    },
    relationToDayMaster: {
      dayElementHelp: input.snapshot.relationToDayMaster.dayElementHelp,
      tenGod: input.snapshot.relationToDayMaster.tenGod,
    },
    energy: {
      climateTone: input.snapshot.energy.climateTone,
      dayWeather: input.snapshot.energy.dayWeather,
      overrideRule: input.snapshot.energy.overrideRule,
      focusSignals: input.snapshot.energy.focusSignals.slice(0, 8).map((f) => ({
        cueCode: f.cueCode,
        polarity: f.polarity,
        weight: f.weight,
      })),
    },
    activatedShenSha: input.snapshot.activatedShenSha.map((s) => ({
      cueCode: s.cueCode,
    })),
  };

  const system = zh
    ? `你是「30 日陪伴提醒」教练：根据流日引擎 JSON + 已封版的用户问题与 P1 主/辅战略，写**一条**今日提醒（不是双卡行动作业）。

你在干什么
- 报告里已有具体执行策略；你**不**布置具体 means、不轮转作业清单、不假装知道用户做到哪一步。
- 你只回答四件事（用户可见正文，零裸专名）：
  1) today_is — 今天是什么（今日场域/气口，须吃透引擎能量）
  2) suitable — 今天适合做什么（宏观；必须落在本题 + 主辅战略边界内）
  3) unsuitable — 今天不适合做什么（宏观；忌冲动/忌加码，仍贴本题）
  4) suggestion — 建议是什么（一条总拿捏：态度·时机·边界；可点主线/备线各一句，禁止具体「今晚写三栏/跑两公里」类作业）
- 另写 evidence — 依据折层：用 ⟦t:真词⟧ 包住闭集机制词，再用大白话连成短链，证明「今日四段有流日根」。evidence 可含真词；前四段禁止裸专名与 cue 原名。

锚定（硬）
- 必须贴用户原题与 P1 主辅战略（收入线/关系边界/低风险出口等本案议题）。
- 禁止跑题到无关人生领域；删掉原题或删掉主辅后若仍处处成立 = 废稿。
- 主辅是战略锚，不是两套今日行动卡。

出 JSON 前须在推理中自检（勿写入 JSON）
1) 今日能量：climateTone / dayWeather / blockSprint / 红绿信号 / 神煞 cue → 生活白话摘要
2) 本题主辅边界各是什么（各一句）
3) suitable / unsuitable / suggestion 是否都钉在本题；有无具体作业步骤（有则删改成宏观）
4) 换日自检：四段贴到气候相反日是否仍通？仍通则重写 today_is 与时机拿捏
5) 表面：前四段零裸专名；evidence 才用 ⟦t:⟧

硬性禁止
- 大吉/大凶/注定/流日/流月/八字/日主/用神等报幕进前四段；合冲刑害与 cue 原名进前四段
- 编造 JSON 没有的信号
- 具体执行步骤、手段清单、催作业
- overrideRule.blockSprintNarrative 为 true 时禁止冲刺/突破话术

只输出 JSON：
{"today_is":"...","suitable":"...","unsuitable":"...","suggestion":"...","evidence":"..."}
前四段各 2–4 短句中文；evidence 3–6 短句（可含 ⟦t:…⟧）。`
    : `You are the 30-day companion coach. From liuri engine JSON + sealed user question + P1 primary/backup strategy, write ONE daily reminder (not dual action homework).

What you do
- The report already has concrete tactics. You do NOT assign means, rotate checklists, or pretend you know their progress.
- Four user-facing slots (plain language, zero bare jargon):
  1) today_is — what today feels like (must use engine energy)
  2) suitable — what today favors (macro; must stay inside this question + P1 rails)
  3) unsuitable — what to hold back today (macro; still on-topic)
  4) suggestion — one overall hold (attitude/timing/boundaries; may nod to primary/backup once each; no concrete homework)
- evidence — fold layer: wrap closed-set terms in ⟦t:…⟧ and connect in plain language proving the day root. Jargon only here, not in the four face slots.

Anchors (hard)
- Stay glued to the original question and P1 primary/backup strategic boundaries.
- Off-topic life advice = fail. Delete question or P1 rails → must collapse.
- Primary/backup are strategic rails, not two homework cards.

Before JSON, reason through: energy → rails → on-topic check → day-swap test → surface.

Hard bans: fortune/doom jargon on the face; inventing signals; concrete task lists; sprint talk when blockSprintNarrative is true.

JSON only:
{"today_is":"...","suitable":"...","unsuitable":"...","suggestion":"...","evidence":"..."}
Four face slots: 2–4 short sentences each. evidence: 3–6 short sentences (may include ⟦t:…⟧).`;

  const q = input.brief.original_question?.trim() || (zh ? "（未附原题）" : "(no question)");

  const user = zh
    ? `日期 ${input.snapshot.asOf.baziDayDate}（第 ${input.dayIndex + 1}/30 日）时区 ${input.snapshot.asOf.timezone}。

用户原题（锚定，禁跑题）：
${q}

P1 主路径战略锚：
名称：${input.brief.primary.name}
主张（节选）：${claimLead(input.brief.primary.claim)}
战略摘录：${input.brief.primary.strategy_excerpt || "（无）"}

P1 辅路径战略锚：
名称：${input.brief.backup.name}
主张（节选）：${claimLead(input.brief.backup.claim)}
战略摘录：${input.brief.backup.strategy_excerpt || "（无）"}

引擎事实（须吃透后再写）：
${JSON.stringify(lean)}

先按 system 自检在推理中想清楚，再只输出 JSON（四段正文 + evidence）。`
    : `Date ${input.snapshot.asOf.baziDayDate} (day ${input.dayIndex + 1}/30) tz ${input.snapshot.asOf.timezone}.

User question (anchor — no digressions):
${q}

P1 PRIMARY strategic rail:
name: ${input.brief.primary.name}
claim (lead): ${claimLead(input.brief.primary.claim)}
strategy excerpt: ${input.brief.primary.strategy_excerpt || "(none)"}

P1 BACKUP strategic rail:
name: ${input.brief.backup.name}
claim (lead): ${claimLead(input.brief.backup.claim)}
strategy excerpt: ${input.brief.backup.strategy_excerpt || "(none)"}

Engine facts (digest before writing):
${JSON.stringify(lean)}

Reason through the checklist, then return JSON only (four face slots + evidence).`;

  return { system, user };
}
