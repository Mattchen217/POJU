/**
 * Companion dual-card daily prompt — locked means × liuri snapshot.
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";

import { meansFocusForDay } from "./extract-companion-brief";
import type { CompanionBrief } from "./types";

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
    ? `你是「主辅双提醒」教练：根据引擎 JSON + 已锁定的主/辅手段，写两张卡（主路径一张、辅路径一张）。

硬性禁止：
- 大吉/大凶/注定/流日/流月/八字/日主/用神等裸专名报幕
- 编造 JSON 没有的冲合
- 改写或发明手段本体（means 只能改时机连接）
- 主卡写辅、辅卡写主；禁止混轨
- overrideRule.blockSprintNarrative 为 true 时禁止冲刺/突破日话术

每张卡三节：field_tone（今日场域）、against_plan（对着这条方案——复述锁定手段）、one_move（今天一小步=时机×该轨焦点手段）。

只输出 JSON：
{"primary":{"field_tone":"...","against_plan":"...","one_move":"..."},"backup":{"field_tone":"...","against_plan":"...","one_move":"..."}}
每字段 2–4 短句中文。`
    : `You are the primary/backup daily coach. From engine JSON + locked track means, write two cards (primary + backup).

Hard bans:
- Fortune doom language; bare metaphysics jargon
- Inventing clashes not in JSON
- Changing the means themselves — only timing connective
- Mixing tracks across cards
- If overrideRule.blockSprintNarrative is true, no sprint/breakthrough framing

Each card: field_tone, against_plan (restate locked means), one_move (today's step = timing × that track's focus means).

JSON only:
{"primary":{"field_tone":"...","against_plan":"...","one_move":"..."},"backup":{"field_tone":"...","against_plan":"...","one_move":"..."}}
Each field: 2–4 short English sentences.`;

  const user = zh
    ? `日期 ${input.snapshot.asOf.baziDayDate}（第 ${input.dayIndex + 1}/30 日）时区 ${input.snapshot.asOf.timezone}。

主路径锁定：
名称：${input.brief.primary.name}
主张：${input.brief.primary.claim}
今日焦点手段（勿改本体）：${primaryFocus}

辅路径锁定：
名称：${input.brief.backup.name}
主张：${input.brief.backup.claim}
今日焦点手段（勿改本体）：${backupFocus}

引擎事实：
${JSON.stringify(lean)}

输出 JSON。`
    : `Date ${input.snapshot.asOf.baziDayDate} (day ${input.dayIndex + 1}/30) tz ${input.snapshot.asOf.timezone}.

PRIMARY locked:
name: ${input.brief.primary.name}
claim: ${input.brief.primary.claim}
today's focus means (do not rewrite the action): ${primaryFocus}

BACKUP locked:
name: ${input.brief.backup.name}
claim: ${input.brief.backup.claim}
today's focus means (do not rewrite the action): ${backupFocus}

Engine facts:
${JSON.stringify(lean)}

Return JSON now.`;

  return { system, user };
}
