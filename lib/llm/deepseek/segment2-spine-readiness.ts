/**
 * Segment 2 · Call A spine readiness gate.
 * Downstream (Call B / collecting / synthesis / delivery) assumes a complete, actionable raw pool.
 * Fail fast here — later stages cannot recover missing or hollow spine fields.
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";

const PLACEHOLDER_NEEDS_RE = /^待补/;

function needsText(raw: string | undefined): string {
  return (raw ?? "").trim();
}

function isActionableNeeds(raw: string | undefined): boolean {
  const t = needsText(raw);
  return t.length >= 4 && !PLACEHOLDER_NEEDS_RE.test(t);
}

export type Segment2ReadinessResult =
  | { ok: true }
  | { ok: false; reason: string; gaps: readonly string[] };

/** Split needs_validation into independent validation facets (generic, not case-specific). */
export function splitNeedsValidationFacets(text: string | undefined): string[] {
  return needsText(text)
    .split(/[？?；;\n]/)
    .map((s) => s.trim().replace(/^[，,、]+|[，,、]+$/g, ""))
    .filter((s) => isActionableNeeds(s));
}

export function validateBreakthroughCoreSpine(core: BreakthroughCore): Segment2ReadinessResult {
  const gaps: string[] = [];

  if (!needsText(core.situation_conclusion)) gaps.push("missing_situation_conclusion");
  if (!needsText(core.energy_structure)) gaps.push("missing_energy_structure");
  if (!needsText(core.response)) gaps.push("missing_response");

  const xc = core.key_crossroads;
  if (!needsText(xc?.real_fork)) gaps.push("missing_real_fork");
  if (!needsText(xc?.path_costs)) gaps.push("missing_path_costs");
  if (!isActionableNeeds(xc?.needs_validation)) gaps.push("missing_key_crossroads_needs_validation");
  else if (splitNeedsValidationFacets(xc.needs_validation).length < 1) {
    gaps.push("key_crossroads_needs_validation_empty_facets");
  }

  const frames = core.modern_action_frames ?? [];
  if (frames.length < 1) gaps.push("modern_action_frames_empty");
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    if (!needsText(frame.direction)) gaps.push(`frame_${i + 1}_missing_direction`);
    if (!isActionableNeeds(frame.needs_validation)) {
      gaps.push(`frame_${i + 1}_missing_needs_validation`);
    }
  }

  const er = core.energy_retune_frame;
  if (!isActionableNeeds(er?.needs_validation)) gaps.push("missing_energy_retune_needs_validation");

  const rf = core.rhythm_frame;
  if (
    !needsText(rf?.phase1_observe) ||
    !needsText(rf?.phase2_adjust) ||
    !needsText(rf?.phase3_consolidate)
  ) {
    gaps.push("incomplete_rhythm_frame");
  }

  const signals = (core.self_check_signals ?? []).filter((s) => typeof s === "string" && s.trim());
  if (signals.length < 3) gaps.push("self_check_signals_lt_3");

  const dims = core.multi_dimension_reckoning ?? [];
  if (dims.length < 3) gaps.push("multi_dimension_reckoning_lt_3");

  if (gaps.length === 0) return { ok: true };
  return { ok: false, reason: gaps[0] ?? "spine_not_ready", gaps };
}

/** VOICE discipline — macro patterns, not case-specific phrases. */
export function extractVoiceThirdSection(response: string): string {
  const text = response.trim();
  const headers = [...text.matchAll(/^###[^\n]*/gm)];
  if (headers.length < 3) return "";
  const start = headers[2]!.index ?? 0;
  const end = headers[3]?.index ?? text.length;
  return text.slice(start, end).trim();
}

/** Section-3 must not preview Call B collection checklist (with or without 比如). */
const VOICE_SECTION3_COLLECTION_LEAK_RE =
  /(?:比如|例如|诸如|像你的|要看你的|对齐——|对齐—|一一确认)[^。！？?\n]{0,96}(?:经济|市场|积蓄|储蓄|安全垫|咨询方向|家人|反对|定位|沟通空间|可投入|近7|一周|每周)|你的(?:安全垫|咨询方向|经济(?:储备)?|积蓄|储蓄|市场定位)[^。！？?\n]{0,48}(?:、|以及|有多|多清晰)|(?:安全垫|咨询方向|反对的?声音).{0,24}(?:有多厚|有多清晰|藏着什么|背后)/;

const VOICE_INTERNAL_SPINE_JARGON_RE =
  /气候交织|守中选点|宜守中|大运甲子|流年引动|用神|忌神|核渊|锚元|盟位|bare_ganzhi|需养见官杀/;

/**
 * Life/character finality as asserted fact (category stems — not Lab case sentences).
 * Hedge wrappers like「有一种可能是你本质上…」still trip this; rewrite without 本质/永远终局茎.
 */
const VOICE_LIFE_VERDICT_RE =
  /本质上就是|本质上你|你本质上|永远只会|永远都是|潜意识早已|潜意识已经|你怀念的不是|怀念的不是(?:他|她|对方)|(?:早已|已经).{0,12}抽离/;

/**
 * Motive / emotional-stock closed as fact without hedge (category stems — not Lab case sentences).
 * Soft「有一种可能…」/「从叙述看像…」should avoid these stems entirely.
 */
const VOICE_MOTIVE_AS_FACT_RE =
  /不是因为还爱[，,]?\s*而是|拖延不是因为|你其实并不|你其实不是|你其实没有|你并不是真的想|潜意识里(?:已经|早已)|习惯性(?:照顾|维持|撑着).{0,16}(?:而非|不是)发自内心|不是不爱|不是太爱|也不是太爱|感情更接近/;

/** Fate / destiny jargon in user-visible VOICE (category — maps to hr_fate family). */
const VOICE_FATE_JARGON_RE = /命运|命定|宿命|天注定|命里|命中注定/;

/**
 * Bare mingli / chart jargon in user-visible VOICE (category — not Lab case stems).
 * Single 金木水火土 as WUXING gloss words are allowed; 干支连写 / 盘报幕 / X势 are not.
 */
const VOICE_DIZHI = "子丑寅卯辰巳午未申酉戌亥";
const VOICE_TIANGAN = "甲乙丙丁戊己庚辛壬癸";
const VOICE_MINGLI_LEAK_RE = new RegExp(
  [
    `[${VOICE_DIZHI}]{2}`,
    `[${VOICE_TIANGAN}][${VOICE_DIZHI}]`,
    `(?:命盘|八字|你的盘|在你的盘|盘里|盘面)`,
    `(?:[金木水火土]势|[金木水火土]旺|[金木水火土]弱)`,
    `(?:补给而非耗损|耗损而非补给)`,
  ].join("|"),
);

/**
 * Section-3 light delivery calendar — phased observe/decide windows (category, not case weeks).
 * Fork tension naming is ok; splitting the window into observe-then-decide schedule is not.
 */
const VOICE_SECTION3_TIMELINE_RX_RE =
  /(?:前|后)\s*\d+\s*周.{0,48}(?:观察|对话|决策|适合)|最后\s*\d+\s*周.{0,32}(?:决策|进入)|(?:前半段|后半段|前半|后半).{0,24}(?:观察|决策)|更适合用来(?:观察|对话|决策)|(?:first|last)\s+\d+\s+weeks?.{0,48}(?:observe|decide|decision)/i;

/** Soft lecture stems that turn a side path into homework (category). */
const VOICE_SIDE_PATH_LECTURE_RE = /你需要警惕|你应当警惕|你需要注意这种|务必警惕/;

export function validateVoiceDiscipline(response: string): Segment2ReadinessResult {
  const gaps: string[] = [];
  const text = response.trim();
  if (!text) {
    gaps.push("missing_response");
    return { ok: false, reason: gaps[0]!, gaps };
  }

  if (/中间路线|最聪明的做法|我最建议|我建议你(走|选)|就该走这条|明确选/.test(text)) {
    gaps.push("voice_route_recommendation");
  }
  // Path nouns in fork discussion (e.g. 「完全裸辞又可能…」) are ok; flag prescriptive verbs only.
  if (
    /(?:建议|应该|不妨|可以试试|不妨试试|需要|必须|最稳妥的是|破局点是).{0,12}(?:在职孵化|裸辞|离职创业|影子项目|副业试水|协商灵活|备孕|结婚生子)/.test(
      text,
    ) ||
    /(?:在职孵化|裸辞创业|裸辞做|先裸辞|每日\d+分钟|近7日|30天计划)/.test(text) ||
    VOICE_SIDE_PATH_LECTURE_RE.test(text)
  ) {
    gaps.push("voice_action_prescription");
  }
  if (/[^。！!]\?|[^。！!]？/.test(text)) {
    gaps.push("voice_contains_question");
  }
  if (!/^[\s\S]*###[\s\S]*###[\s\S]*###/.test(text)) {
    gaps.push("voice_missing_three_sections");
  }
  if (VOICE_LIFE_VERDICT_RE.test(text)) {
    gaps.push("voice_life_verdict");
  }
  if (VOICE_MOTIVE_AS_FACT_RE.test(text)) {
    gaps.push("voice_motive_as_fact");
  }
  if (VOICE_FATE_JARGON_RE.test(text)) {
    gaps.push("voice_fate_jargon");
  }
  if (VOICE_MINGLI_LEAK_RE.test(text)) {
    gaps.push("voice_mingli_leak");
  }
  if (/盟位/.test(text)) {
    gaps.push("voice_internal_spine_jargon");
  }

  const section3 = extractVoiceThirdSection(text);
  if (section3) {
    if (VOICE_SECTION3_COLLECTION_LEAK_RE.test(section3)) {
      gaps.push("voice_section3_collection_leak");
    }
    if (VOICE_INTERNAL_SPINE_JARGON_RE.test(section3)) {
      gaps.push("voice_internal_spine_jargon");
    }
    if (VOICE_SECTION3_TIMELINE_RX_RE.test(section3)) {
      gaps.push("voice_section3_timeline_rx");
    }
  }

  if (gaps.length === 0) return { ok: true };
  return { ok: false, reason: gaps[0] ?? "voice_not_ready", gaps };
}

/** Strip section-3 collection previews / internal jargon without replacing whole VOICE. */
export function remediateVoiceSection3Leaks(response: string, locale: string): string {
  const zh = !locale || locale.startsWith("zh");
  const genericClose = zh
    ? "结构已经看得很清楚了，但具体怎么走，还要看你的实际情况对齐。"
    : "The structure is clearer now, but the path still needs your real-world alignment.";

  const headers = [...response.matchAll(/^###[^\n]*/gm)];
  if (headers.length < 3) return response;

  const thirdStart = headers[2]!.index ?? 0;
  const thirdEnd = headers[3]?.index ?? response.length;
  const before = response.slice(0, thirdStart);
  const thirdHeader = headers[2]![0];
  let body = response.slice(thirdStart + thirdHeader.length, thirdEnd).trim();

  body = body
    .split(/(?<=[。！？!?.])\s+/)
    .filter((sentence) => {
      const s = sentence.trim();
      if (!s) return false;
      if (VOICE_SECTION3_COLLECTION_LEAK_RE.test(s)) return false;
      if (VOICE_INTERNAL_SPINE_JARGON_RE.test(s)) return false;
      if (VOICE_SECTION3_TIMELINE_RX_RE.test(s)) return false;
      return true;
    })
    .join(" ")
    .trim();

  if (!body || body.length < 20) {
    body = genericClose;
  } else if (!/(实际情况|real-world|align)/i.test(body)) {
    body = `${body}\n\n${genericClose}`;
  }

  const after = response.slice(thirdEnd);
  return `${before}${thirdHeader}\n\n${body}${after}`.trim();
}

export function validateSegment2CallAReadiness(core: BreakthroughCore): Segment2ReadinessResult {
  const spine = validateBreakthroughCoreSpine(core);
  if (!spine.ok) return spine;
  if (core.response?.trim()) {
    const voice = validateVoiceDiscipline(core.response);
    if (!voice.ok) return voice;
  }
  return { ok: true };
}

export class Segment2ReadinessError extends Error {
  readonly gaps: readonly string[];

  constructor(message: string, gaps: readonly string[] = []) {
    super(message);
    this.name = "Segment2ReadinessError";
    this.gaps = gaps;
  }
}

export function ensureSegment2CallAReadiness(core: BreakthroughCore): BreakthroughCore {
  const check = validateSegment2CallAReadiness(core);
  if (!check.ok) {
    throw new Segment2ReadinessError(check.reason, check.gaps);
  }
  return core;
}

/** Spine-only gate (VOICE may be auto-remediated upstream). */
export function ensureSegment2SpineReady(core: BreakthroughCore): BreakthroughCore {
  const check = validateBreakthroughCoreSpine(core);
  if (!check.ok) {
    throw new Segment2ReadinessError(check.reason, check.gaps);
  }
  return core;
}
