/**
 * Deterministic plain-language energy digest for companion daily feed.
 * Must differentiate adjacent days even when climateTone/dayWeather match.
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";

export type CompanionEnergyDigest = {
  climate_plain: string;
  weather_plain: string;
  pace_plain: string;
  ten_god_plain: string | null;
  help_plain: string;
  window_plain: string;
  diff_plain: string;
  green_weight: number;
  red_weight: number;
  block_sprint: boolean;
  shensha_plain: string[];
  /** Closed-set 十神汉字（若有）— evidence 才可用 ⟦t:slug|白话⟧ */
  ten_god_han: string | null;
  ten_god_slug: string | null;
  day_element_help: string;
  summary_lines: string[];
};

const TEN_GOD_SLUG: Record<string, string> = {
  比肩: "bi_jian",
  劫财: "jie_cai",
  食神: "shi_shen",
  伤官: "shang_guan",
  偏财: "pian_cai",
  正财: "zheng_cai",
  七杀: "qi_sha",
  正官: "zheng_guan",
  偏印: "pian_yin",
  正印: "zheng_yin",
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

function tenGodPlain(han: string | null, zh: boolean): string | null {
  if (!han) return null;
  const mapZh: Record<string, string> = {
    伤官: "今日心智偏「拆开看清」：适合把缠在一起的线剥开，不宜把拆解冲动直接变成拍板",
    食神: "今日心智偏「慢慢消化」：适合把压力酿成可说清的边界，不宜急着表态交差",
    正财: "今日心智偏「守住实得」：适合巩固已有收入与可验证进展，不宜为未落地承诺加码",
    偏财: "今日心智偏「看见机会」：适合只做低风险了解，不宜把窗口错当成必须下注",
    正官: "今日心智偏「规则与责任」：适合把该守的边界说清楚，不宜被责任感推着做不可逆选择",
    七杀: "今日心智偏「被逼推进」：适合把压力点命名出来，不宜在压迫感里做急救式决定",
    正印: "今日心智偏「回神与支持」：适合先稳住自己，不宜为证明什么去加码",
    偏印: "今日心智偏「信息杂讯」：适合少开新线、先过滤，不宜同时处理太多不确定选项",
    比肩: "今日心智偏「并排较劲」：适合守住自己的节奏，不宜被他人进度带着跑",
    劫财: "今日心智偏「资源拉扯」：适合先守住底线，不宜在拉扯中让步过大",
  };
  const mapEn: Record<string, string> = {
    伤官: "Mindset leans toward unpacking — separate tangled threads; don't turn analysis into a verdict",
    食神: "Mindset leans toward digesting — turn pressure into speakable boundaries; don't rush a performance answer",
    正财: "Mindset leans toward securing real gains — consolidate income/progress; don't upsize for vapor promises",
    偏财: "Mindset leans toward spotting options — low-risk look only; don't treat a window as a must-bet",
    正官: "Mindset leans toward duty/rules — name the boundary; don't let duty force an irreversible call",
    七杀: "Mindset leans toward pressure-push — name the squeeze; don't make emergency decisions under it",
    正印: "Mindset leans toward regrounding — stabilize yourself first; don't upsize to prove something",
    偏印: "Mindset leans toward noisy info — filter before opening new threads",
    比肩: "Mindset leans toward peer pacing — keep your rhythm; don't get dragged by others' timelines",
    劫财: "Mindset leans toward resource tug — hold the floor; don't over-concede in the pull",
  };
  return (zh ? mapZh : mapEn)[han] ?? null;
}

function helpPlain(help: string, zh: boolean): string {
  switch (help) {
    case "helps":
      return zh ? "当日与自身节奏较合拍，宜用来巩固，不宜用来冒险加注" : "Day pace fits you — consolidate, don't gamble upsides";
    case "drains":
      return zh ? "当日更耗自身节奏，宜减负分线，不宜硬扛多线" : "Day drains your pace — lighten load; don't force multi-track";
    case "mixed":
      return zh ? "当日对自身有帮有耗，宜分清哪条线可推、哪条线只观察" : "Day both helps and drains — push one thread, watch the other";
    default:
      return zh ? "当日对自身影响偏中性，宜按既定主辅边界行动" : "Day is neutral on your pace — stay inside known rails";
  }
}

function windowPlain(dayIndex: number, zh: boolean): string {
  const n = dayIndex + 1;
  if (dayIndex <= 6) {
    return zh
      ? `陪伴窗前段（第 ${n}/30 日）：宜先立边界与分线，少做窗末才该做的终局选择`
      : `Early companion window (day ${n}/30): set boundaries and separate threads; avoid end-window final calls`;
  }
  if (dayIndex <= 20) {
    return zh
      ? `陪伴窗中段（第 ${n}/30 日）：宜检验前段边界是否还站得住，仍忌用顺当感改写战略`
      : `Mid companion window (day ${n}/30): test whether early boundaries still hold; don't rewrite strategy on ease`;
  }
  return zh
    ? `陪伴窗后段（第 ${n}/30 日）：宜收束与复盘，忌在窗末被倒计时情绪绑架做急救决定`
    : `Late companion window (day ${n}/30): consolidate and review; don't let end-window panic force emergency calls`;
}

function signalFlavor(
  signals: AtmosEngineSnapshot["energy"]["focusSignals"],
  zh: boolean,
): { alignment: number; sting: number; disrupt: number; flavor_plain: string } {
  let alignment = 0;
  let sting = 0;
  let disrupt = 0;
  for (const s of signals) {
    const code = s.cueCode.toLowerCase();
    const w = s.weight;
    if (code.includes("penalty") || code.includes("harm") || code.includes("punish")) {
      sting += w;
    } else if (code.includes("clash") || code.includes("冲")) {
      disrupt += w;
    } else if (
      code.includes("combine") ||
      code.includes("half") ||
      code.includes("合")
    ) {
      alignment += w;
    } else if (s.polarity === "red") {
      sting += w;
    } else if (s.polarity === "green") {
      alignment += w;
    }
  }
  let flavor_plain: string;
  if (sting >= alignment && sting > 0) {
    flavor_plain = zh
      ? "今日信号味道偏「刺点」：顺的底下有扎感，宜先命名压力，不宜假装已经顺了"
      : "Signal flavor leans sting — name the pressure under the ease; don't pretend it's all smooth";
  } else if (disrupt > 0 && disrupt >= sting) {
    flavor_plain = zh
      ? "今日信号味道偏「节奏扰动」：计划可能被打断，宜留弹性，不宜排死终局"
      : "Signal flavor leans disruption — leave slack; don't lock a final script";
  } else if (alignment > 0) {
    flavor_plain = zh
      ? "今日信号味道偏「对齐」：适合把线慢慢合拢，但仍是合拢过程，不是盖章时刻"
      : "Signal flavor leans alignment — slow joining of threads, not a stamp moment";
  } else {
    flavor_plain = zh
      ? "今日信号味道偏淡：宜做巩固与观察，不宜制造高潮叙事"
      : "Signal flavor is mild — consolidate and observe; no climax narrative";
  }
  return { alignment, sting, disrupt, flavor_plain };
}

function shenshaPlain(cue: string, zh: boolean): string | null {
  switch (cue) {
    case "ask_help":
      return zh ? "神煞提示：适合沟通与求助，不宜独自硬扛" : "Cue: favors asking for help / clear talks";
    case "movement":
      return zh ? "神煞提示：切换与奔波可能偏多，预留缓冲" : "Cue: more switching/transit — plan buffers";
    case "deep_work":
      return zh ? "神煞提示：适合专注梳理，不宜同时开多条新线" : "Cue: favors focused sorting — not many new threads";
    default:
      return null;
  }
}

function buildDiffPlain(input: {
  zh: boolean;
  dateKey: string;
  dayIndex: number;
  ten_god_plain: string | null;
  flavor_plain: string;
  weather: string;
  climate: string;
}): string {
  const { zh, dateKey, dayIndex, ten_god_plain, flavor_plain, weather, climate } = input;
  const mind = ten_god_plain
    ? ten_god_plain.replace(/^今日心智偏|Mindset leans toward /i, "").slice(0, 28)
    : zh
      ? "节奏中性"
      : "neutral pace";
  if (zh) {
    return `【今日差分·必须写入 today_is】${dateKey}（第 ${dayIndex + 1}/30 日）· 气候${climate}/${weather} · ${flavor_plain} · 心智侧重：${mind}。换日若差分不同，today_is 不得复用昨日句式。`;
  }
  return `【DAY DIFF — must shape today_is】${dateKey} (day ${dayIndex + 1}/30) · climate ${climate}/${weather} · ${flavor_plain} · mindset: ${mind}. If this diff changes across days, today_is must not reuse yesterday's wording.`;
}

/** Build feed digest from AtmosEngineSnapshot (no cueCode strings for the model to echo). */
export function buildCompanionEnergyDigest(
  snapshot: AtmosEngineSnapshot,
  locale: string,
  dayIndex = 0,
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
  const flavor = signalFlavor(signals, zh);

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
  const ten_god_slug = ten ? (TEN_GOD_SLUG[ten] ?? null) : null;
  const ten_god_plain = tenGodPlain(ten, zh);
  const help = snapshot.relationToDayMaster.dayElementHelp;
  const help_plain = helpPlain(help, zh);
  const window_plain = windowPlain(dayIndex, zh);
  const dateKey = snapshot.asOf.baziDayDate;
  const diff_plain = buildDiffPlain({
    zh,
    dateKey,
    dayIndex,
    ten_god_plain,
    flavor_plain: flavor.flavor_plain,
    weather: snapshot.energy.dayWeather,
    climate: snapshot.energy.climateTone,
  });

  const summary_lines = [
    diff_plain,
    climate_plain,
    weather_plain,
    pace_plain,
    flavor.flavor_plain,
    ...(ten_god_plain ? [ten_god_plain] : []),
    help_plain,
    window_plain,
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
    ten_god_plain,
    help_plain,
    window_plain,
    diff_plain,
    green_weight,
    red_weight,
    block_sprint,
    shensha_plain,
    ten_god_han: ten,
    ten_god_slug,
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
  out = out.replace(
    /⟦t:(dayWeather|climateTone|tenGod|dayElementHelp|overrideRule|focusSignals|asOf|liuri|liuyue|Branch_[A-Za-z]+|DayBranch_[A-Za-z]+|ask_help|movement|deep_work|ease|friction|volatile|supportive|pressured|mixed|neutral|helps|drains|strong|weak|balanced)(?:\|[^⟧]*)?⟧/gi,
    "",
  );
  out = out.replace(
    /\b(ease|friction|volatile|supportive|pressured|climateTone|dayWeather|Branch_Penalty|Branch_HalfCombine|Branch_Combine)\b/gi,
    "",
  );
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([，。,.])/g, "$1").trim();
  return out;
}
