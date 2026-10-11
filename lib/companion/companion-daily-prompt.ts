/**
 * Companion dual-card daily prompt — locked means × liuri snapshot.
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";

import { meansFocusForDay } from "./extract-companion-brief";
import type { CompanionBrief } from "./types";

function claimLead(claim: string, max = 420): string {
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
  const primaryFocus = meansFocusForDay(input.brief.primary, input.dayIndex);
  const backupFocus = meansFocusForDay(input.brief.backup, input.dayIndex);

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
    ? `你是「主辅双提醒」教练：用引擎 JSON 给「已锁定的主/辅手段」加今日时机连接，写出两张卡（主路径一张、辅路径一张）。

你在干什么
- 不是重写方案，不是新开药方，不是日运批断墙。
- 是：锁死主辅轨 × 今日能量事实 → 今晚可做的一小步。
- 三节职责必须分开：
  · field_tone = 今日场域读感（必须吃透 climateTone / dayWeather / 红绿信号 / overrideRule / 神煞 cue；换一天应换脸）
  · against_plan = 复述该轨锁定主张与边界（钉住报告主辅，禁止漂成鸡汤）
  · one_move = 今日焦点手段本体不变 + 只加时机连接（轻重/先后/暂缓/写完再发等）

出 JSON 前必须在推理里按序自检（勿写入 JSON）
1) 今日能量摘要：climateTone、dayWeather、blockSprint 是否成立、绿/红信号谁更重、神煞 cue 含义（只用生活白话，不报 cue 原名）
2) 主轨：焦点 means 原文要点是什么？今日能量如何改变「怎么做」而不是「做什么」？
3) 辅轨：同上，且确认与主轨不混（手段、边界、地名/议题不串）
4) 换日自检：若把今天的 field_tone / one_move 贴到气候相反的一天是否仍通？仍通 = 不合格，重写时机连接
5) 表面自检：卡面零裸专名；禁止把合/冲/刑/半合/食神/伤官/神煞码当用户可见词

硬性禁止
- 大吉/大凶/注定/流日/流月/八字/日主/用神等裸专名报幕；关系专名与引擎 cue 原名进卡面
- 编造 JSON 没有的冲合或信号
- 改写或发明手段本体（means 只能改时机连接）
- 主卡写辅、辅卡写主；禁止混轨
- overrideRule.blockSprintNarrative 为 true 时禁止冲刺/突破日话术
- against_plan 禁止只复读 means；必须带该轨战略边界（收入线/低风险出口等）

只输出 JSON：
{"primary":{"field_tone":"...","against_plan":"...","one_move":"..."},"backup":{"field_tone":"...","against_plan":"...","one_move":"..."}}
每字段 2–4 短句中文。`
    : `You are the primary/backup daily coach: connect today's engine JSON to locked track means. Two cards (primary + backup).

What you are doing
- Not rewriting the plan, not inventing a new prescription, not a classical day-pillar essay.
- Locked tracks × today's energy → one small step tonight.
- Slot duties:
  · field_tone = today's field read (must use climateTone / dayWeather / red-green signals / overrideRule / shensha cues; must change across days)
  · against_plan = restate that track's locked claim/boundaries (stay glued to the report)
  · one_move = keep focus means intact; only add timing connective (intensity / order / pause / draft overnight)

Before JSON, reason through this checklist (do not put the checklist in the JSON)
1) Summarize today's energy in plain language from the facts
2) Primary: what is the focus means; how does today change how (not what) to do it
3) Backup: same; no track mixing
4) Day-swap test: would today's field_tone/one_move still fit an opposite climate day? If yes, rewrite timing
5) Surface: zero bare jargon; no cue codes or classical relation names on the card face

Hard bans
- Fortune/doom language; bare metaphysics jargon; cue codes on the face
- Inventing clashes/signals not in JSON
- Changing the means themselves — only timing connective
- Mixing tracks
- If overrideRule.blockSprintNarrative is true, no sprint/breakthrough framing
- against_plan must carry track strategy boundaries, not only restate means

JSON only:
{"primary":{"field_tone":"...","against_plan":"...","one_move":"..."},"backup":{"field_tone":"...","against_plan":"...","one_move":"..."}}
Each field: 2–4 short English sentences.`;

  const user = zh
    ? `日期 ${input.snapshot.asOf.baziDayDate}（第 ${input.dayIndex + 1}/30 日）时区 ${input.snapshot.asOf.timezone}。

主路径锁定：
名称：${input.brief.primary.name}
主张（节选）：${claimLead(input.brief.primary.claim)}
战略摘录：${input.brief.primary.strategy_excerpt || "（无）"}
今日焦点手段（勿改本体）：${primaryFocus}

辅路径锁定：
名称：${input.brief.backup.name}
主张（节选）：${claimLead(input.brief.backup.claim)}
战略摘录：${input.brief.backup.strategy_excerpt || "（无）"}
今日焦点手段（勿改本体）：${backupFocus}

引擎事实（须吃透后再写卡）：
${JSON.stringify(lean)}

先按 system 自检序在推理中想清楚，再只输出 JSON。`
    : `Date ${input.snapshot.asOf.baziDayDate} (day ${input.dayIndex + 1}/30) tz ${input.snapshot.asOf.timezone}.

PRIMARY locked:
name: ${input.brief.primary.name}
claim (lead): ${claimLead(input.brief.primary.claim)}
strategy excerpt: ${input.brief.primary.strategy_excerpt || "(none)"}
today's focus means (do not rewrite the action): ${primaryFocus}

BACKUP locked:
name: ${input.brief.backup.name}
claim (lead): ${claimLead(input.brief.backup.claim)}
strategy excerpt: ${input.brief.backup.strategy_excerpt || "(none)"}
today's focus means (do not rewrite the action): ${backupFocus}

Engine facts (must digest before writing):
${JSON.stringify(lean)}

Reason through the system checklist, then return JSON only.`;

  return { system, user };
}
