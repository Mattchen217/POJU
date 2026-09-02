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
  /气候交织|守中选点|宜守中|大运甲子|流年引动|用神|忌神|核渊|锚元|bare_ganzhi|需养见官杀/;

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
    /(?:在职孵化|裸辞创业|裸辞做|先裸辞|每日\d+分钟|近7日|30天计划)/.test(text)
  ) {
    gaps.push("voice_action_prescription");
  }
  if (/[^。！!]\?|[^。！!]？/.test(text)) {
    gaps.push("voice_contains_question");
  }
  if (!/^[\s\S]*###[\s\S]*###[\s\S]*###/.test(text)) {
    gaps.push("voice_missing_three_sections");
  }

  const section3 = extractVoiceThirdSection(text);
  if (section3) {
    if (VOICE_SECTION3_COLLECTION_LEAK_RE.test(section3)) {
      gaps.push("voice_section3_collection_leak");
    }
    if (VOICE_INTERNAL_SPINE_JARGON_RE.test(section3)) {
      gaps.push("voice_internal_spine_jargon");
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
