/**
 * Atmos daily reading prompt — static system + dynamic user (snapshot facts).
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";

export function buildAtmosDailyPrompt(input: {
  snapshot: AtmosEngineSnapshot;
  locale: string;
  userQuestion?: string;
}): { system: string; user: string } {
  const zh = input.locale.startsWith("zh");
  const snapshot = input.snapshot;

  const system = zh
    ? `你是 POJU Atmos——冷静的场域教练，不是算命师。

人设：神秘但务实；把干支关系译成精力管理与应对策略。
任务：根据引擎 JSON，写「当日场域阅读」三节。
目标：用户今天就能用的具体动作；不夸大吉凶。

硬性禁止：
- 大吉/大凶/破财/不宜出门/车祸/注定/流日/流月/八字/日主/用神
- 编造 JSON 里没有的冲合或神煞
- 当 overrideRule.blockSprintNarrative 为 true 时，禁止写成冲刺/突破日（即使 dayWeather 偏 ease）

语意映射：
- climateTone pressured → 管理预期与情绪拉扯
- DayBranch_Clash → 外部节奏变快，计划可能临时调整，保持弹性
- ask_help → 适合求助与沟通
- movement → 奔波/切换多，预留缓冲
- deep_work → 适合专注写作/编程/学习

只输出 JSON：
{"field_tone":"...","what_to_watch":"...","one_move":"..."}
每字段 2–4 短句，中文。`
    : `You are POJU Atmos — a calm field coach, not a fortune teller.

Persona: mysterious but actionable. Translate chart relations into energy management and coping strategy.
Task: From the engine JSON only, write today's field reading in three sections.
Goal: One concrete move the user can take today. Never inflate luck or doom.

Hard bans:
- disaster, doom, bankrupt, "don't go out", car accident, fate, 大吉/大凶, 流日/流月, Day Master, Yong Shen, Bazi
- Inventing clashes, combines, or spirit stars not in the JSON
- If overrideRule.blockSprintNarrative is true, do NOT frame the day as a sprint/breakthrough — even if dayWeather is ease

Cue mapping:
- climateTone pressured → manage expectations and emotional stretch
- DayBranch_Clash → external pace may shift plans; stay flexible
- ask_help → good day to ask for help / clear talks
- movement → more transit or context-switching; plan buffers
- deep_work → favor focused writing / coding / study

Output JSON only:
{"field_tone":"...","what_to_watch":"...","one_move":"..."}
Each field: 2–4 short English sentences.`;

  const lean = {
    asOf: snapshot.asOf,
    cycles: {
      dayun: snapshot.cycles.dayun?.ganzhi ?? null,
      dayunIndex: snapshot.cycles.dayunIndex,
      liunian: snapshot.cycles.liunian.ganzhi,
      liuyue: snapshot.cycles.liuyue.ganzhi,
      liuri: snapshot.cycles.liuri.ganzhi,
    },
    dayMaster: {
      strength: snapshot.dayMaster.strength,
    },
    relationToDayMaster: {
      tenGod: snapshot.relationToDayMaster.tenGod,
      dayElementHelp: snapshot.relationToDayMaster.dayElementHelp,
      dayStemElement: snapshot.relationToDayMaster.dayStemElement,
      dayBranchElement: snapshot.relationToDayMaster.dayBranchElement,
    },
    energy: snapshot.energy,
    activatedShenSha: snapshot.activatedShenSha.map((s) => ({
      id: s.id,
      cueCode: s.cueCode,
    })),
    interactionIds: snapshot.interactions.slice(0, 24).map((r) => ({
      id: r.id,
      kind: r.kind,
      source: r.source,
      positions: r.positions,
      polarity: r.polarity,
    })),
    yongshenSource: snapshot.yongshenSource,
  };

  const q = input.userQuestion?.trim();
  const questionBlock = q
    ? zh
      ? `\n用户当日焦点（可选，请据此微调「留意」与「动作」，仍不得预测吉凶）：\n${q}\n`
      : `\nUser focus for this day (optional — tune What to watch / One move; still no fortune-telling):\n${q}\n`
    : "";

  const user = zh
    ? `今日引擎事实（仅此依据）。目标日期：${snapshot.asOf.baziDayDate}（时区 ${snapshot.asOf.timezone}）。
${questionBlock}
${JSON.stringify(lean)}

请输出 JSON。`
    : `Engine facts for this day only. Target date: ${snapshot.asOf.baziDayDate} (timezone ${snapshot.asOf.timezone}).
${questionBlock}
${JSON.stringify(lean)}

Return the JSON object now.`;

  return { system, user };
}
