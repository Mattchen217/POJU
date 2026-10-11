/**
 * Single-day companion category gate (Lab + production share).
 * Categories only — no case-phrase patches from Lab dumps.
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

function midWindowSuggestionOk(suggestion: string, locale: string): boolean {
  const s = suggestion.toLowerCase();
  if (locale.startsWith("zh")) {
    return /检验|站得住|还站|边界是否|前段边界|仍忌|改写战略/.test(suggestion);
  }
  if (locale.startsWith("es")) {
    return /l[ií]mite|aguant|tempran|comprob|seguir/.test(s);
  }
  if (locale.startsWith("fr")) {
    return /limite|d[eé]but|tenir|test|tenir|v[eé]rifi/.test(s);
  }
  return /boundar|still hold|early|test whether|rewrite strategy|hold/.test(s);
}

function lateWindowSuggestionOk(suggestion: string, locale: string): boolean {
  const s = suggestion.toLowerCase();
  if (locale.startsWith("zh")) {
    return /收束|复盘|倒计时|窗末|急救/.test(suggestion);
  }
  if (locale.startsWith("es")) {
    return /cerrar|revis|cuenta regresiva|p[aá]nico|fin/.test(s);
  }
  if (locale.startsWith("fr")) {
    return /resserr|revoir|compte.?[aà] rebours|panique|fin de fen/.test(s);
  }
  return /consolidat|review|end-window|panic|countdown|close/.test(s);
}

/**
 * Gate one day's cards. dayIndex 0–29 for window-phase checks.
 */
export function gateCompanionDay(input: {
  cards: CompanionDayCards;
  dayIndex: number;
  locale: string;
}): CompanionDayGateResult {
  const { cards, dayIndex, locale } = input;
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

  // mid: dayIndex 7–20；late: 21–29
  if (dayIndex >= 7 && dayIndex <= 20) {
    if (!midWindowSuggestionOk(cards.suggestion, locale)) {
      return {
        passed: false,
        failed_rule: "companion_mid_window_suggestion_missing",
        detail: "中段 suggestion 须点明检验前段边界（或等价），禁只写通用分线",
      };
    }
  }
  if (dayIndex >= 21) {
    if (!lateWindowSuggestionOk(cards.suggestion, locale)) {
      return {
        passed: false,
        failed_rule: "companion_late_window_suggestion_missing",
        detail: "后段 suggestion 须点明收束/复盘或忌倒计时绑架",
      };
    }
  }

  return { passed: true };
}
