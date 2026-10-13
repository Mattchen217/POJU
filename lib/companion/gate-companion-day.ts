/**
 * Single-day companion category gate (Lab + production share).
 * Principle-only: absolute bans + emptiness. No phrase-keyword micromanagement —
 * mid/late window wording varies by model; that stays human review / prompt duty.
 */

import type { CompanionDayCards } from "./types";

export type CompanionDayGateResult = {
  passed: boolean;
  failed_rule?: string;
  detail?: string;
};

function hasEngineeringWeights(text: string): boolean {
  return (
    /绿\s*\d+|红\s*\d+/u.test(text) ||
    /绿\d+\s*红\d+/u.test(text) ||
    /\bgreen\s*[:=]?\s*\d+/i.test(text) ||
    /\bred\s*[:=]?\s*\d+/i.test(text)
  );
}

/** 对齐+盖章 as sole today_is skeleton (category — whole class). */
function hasAlignmentStampSkeleton(todayIs: string): boolean {
  const t = todayIs.replace(/\s+/g, "");
  // Fail only when both halves of the banned skeleton co-occur
  return /对齐/.test(t) && /盖章/.test(t);
}

/**
 * Gate one day's cards.
 * `dayIndex` / `locale` kept for call-site stability; phase phrase checks removed.
 */
export function gateCompanionDay(input: {
  cards: CompanionDayCards;
  dayIndex: number;
  locale: string;
}): CompanionDayGateResult {
  const { cards } = input;
  const allFace = [
    cards.today_is,
    cards.suitable,
    cards.unsuitable,
    cards.suggestion,
    cards.evidence,
  ].join("\n");

  if (hasEngineeringWeights(allFace)) {
    return {
      passed: false,
      failed_rule: "companion_evidence_weight_dump",
      detail: "可见字段含绿/红数字或 green/red 工程量 — 只用信号平衡白话",
    };
  }

  if (hasAlignmentStampSkeleton(cards.today_is)) {
    return {
      passed: false,
      failed_rule: "companion_today_is_align_stamp_skeleton",
      detail: "today_is 落入「对齐+盖章」万能骨架 — 须写本差分心智侧重，禁该骨架",
    };
  }

  const faceLen =
    cards.today_is.length +
    cards.suitable.length +
    cards.unsuitable.length +
    cards.suggestion.length;
  if (faceLen < 80) {
    return {
      passed: false,
      failed_rule: "companion_face_too_thin",
      detail: "前四段过薄",
    };
  }

  return { passed: true };
}
