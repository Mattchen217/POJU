/**
 * Deterministic plain-language energy digest for companion daily feed.
 * Keeps LLM off engine field names / cueCodes in user-facing evidence.
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";

export type CompanionEnergyDigest = {
  climate_plain: string;
  weather_plain: string;
  pace_plain: string;
  green_weight: number;
  red_weight: number;
  block_sprint: boolean;
  shensha_plain: string[];
  /** Closed-set 十神汉字（若有）— evidence 才可用 ⟦t:slug|白话⟧ */
  ten_god_han: string | null;
  day_element_help: string;
  summary_lines: string[];
};

function climatePlain(tone: string, zh: boolean): string {
  switch (tone) {
    case "pressured":
      return zh ? "外界拉扯偏紧，宜管预期、少硬推" : "Outer stretch is high — manage expectations, avoid forcing";
    case "supportive":
      return zh ? "外界有托底感，宜稳住节奏、忌误读成可冲刺" : "Outer support is present — steady pace, not a sprint green light";
    case "mixed":
      return zh ? "外界顺逆夹杂，宜分线处理、少一口咬定" : "Mixed outer signals — separate threads, avoid all-or-nothing calls";
    default:
      return zh ? "外界信号偏平，宜小步观察" : "Outer field is flat — favor small observations";
  }
}

function weatherPlain(w: string, zh: boolean): string {
  switch (w) {
    case "ease":
      return zh ? "当日推进阻力偏小，容易产生「已经想通」的错觉" : "Day friction is low — easy to mistake ease for clarity";
    case "friction":
      return zh ? "当日摩擦偏多，计划易被打断，宜留缓冲" : "Day friction is high — plans may slip; leave buffer";
    case "volatile":
      return zh ? "当日波动偏大，宜少做不可逆加码" : "Day is volatile — avoid irreversible upsizes";
    default:
      return zh ? "当日天气中性，宜按既定边界行动" : "Day weather is neutral — stay inside known boundaries";
  }
}

function shenshaPlain(cue: string, zh: boolean): string | null {
  switch (cue) {
    case "ask_help":
      return zh ? "适合沟通与求助，不宜独自硬扛" : "Favors asking for help / clear talks";
    case "movement":
      return zh ? "切换与奔波可能偏多，预留缓冲" : "More switching/transit — plan buffers";
    case "deep_work":
      return zh ? "适合专注梳理，不宜同时开多条新线" : "Favors focused sorting — not opening many new threads";
    default:
      return null;
  }
}

/** Build feed digest from AtmosEngineSnapshot (no cueCode strings for the model to echo). */
export function buildCompanionEnergyDigest(
  snapshot: AtmosEngineSnapshot,
  locale: string,
): CompanionEnergyDigest {
  const zh = locale.startsWith("zh");
  const signals = snapshot.energy.focusSignals ?? [];
  let green_weight = 0;
  let red_weight = 0;
  for (const s of signals) {
    if (s.polarity === "green") green_weight += s.weight;
    if (s.polarity === "red") red_weight += s.weight;
  }

  const climate_plain = climatePlain(snapshot.energy.climateTone, zh);
  const weather_plain = weatherPlain(snapshot.energy.dayWeather, zh);
  const block_sprint = snapshot.energy.overrideRule.blockSprintNarrative === true;

  const pace_plain =
    red_weight > 0 && green_weight > red_weight
      ? zh
        ? "对齐信号多于刺点：适合慢慢分线对齐，不适合趁热拍板"
        : "Alignment weight exceeds sting — favor slow separation of threads, not hot decisions"
      : red_weight >= green_weight && red_weight > 0
        ? zh
          ? "刺点分量不轻：顺的假象下更易把急误当成决定"
          : "Sting weight is material — ease can disguise urgency as a decision"
        : zh
          ? "信号偏和：宜巩固既定边界，少开新战场"
          : "Signals are mild — consolidate boundaries, open few new fronts";

  const shensha_plain = snapshot.activatedShenSha
    .map((s) => shenshaPlain(s.cueCode, zh))
    .filter((x): x is string => Boolean(x));

  const ten = snapshot.relationToDayMaster.tenGod?.trim() || null;
  const help = snapshot.relationToDayMaster.dayElementHelp;

  const summary_lines = [
    climate_plain,
    weather_plain,
    pace_plain,
    block_sprint
      ? zh
        ? "硬规则：今日禁止冲刺/突破叙事"
        : "Hard rule: no sprint/breakthrough framing today"
      : zh
        ? "硬规则：未封锁冲刺叙事，但仍忌把顺当许可去押大注"
        : "Hard rule: sprint not blocked, but ease is not a license to bet big",
    ...shensha_plain,
  ];

  return {
    climate_plain,
    weather_plain,
    pace_plain,
    green_weight,
    red_weight,
    block_sprint,
    shensha_plain,
    ten_god_han: ten,
    day_element_help: help,
    summary_lines,
  };
}

/**
 * Strip illegal evidence markers: engine keys, cueCodes, English enums.
 * Closed-set `⟦t:slug|plain⟧` kept when slug is snake_case glossary-like.
 */
export function sanitizeCompanionEvidenceMarkers(evidence: string): string {
  let out = evidence;
  // Engine field / cue / enum dumps: ⟦t:dayWeather⟧ or ⟦t:Branch_Penalty⟧ or ⟦t:ease⟧
  out = out.replace(
    /⟦t:(dayWeather|climateTone|tenGod|dayElementHelp|overrideRule|focusSignals|asOf|liuri|liuyue|Branch_[A-Za-z]+|DayBranch_[A-Za-z]+|ask_help|movement|deep_work|ease|friction|volatile|supportive|pressured|mixed|neutral|helps|drains|strong|weak|balanced)(?:\|[^⟧]*)?⟧/gi,
    "",
  );
  // Bare English enums left after strip
  out = out.replace(
    /\b(ease|friction|volatile|supportive|pressured|climateTone|dayWeather|Branch_Penalty|Branch_HalfCombine|Branch_Combine)\b/gi,
    "",
  );
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([，。,.])/g, "$1").trim();
  return out;
}
