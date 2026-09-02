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

  if (gaps.length === 0) return { ok: true };
  return { ok: false, reason: gaps[0] ?? "voice_not_ready", gaps };
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
