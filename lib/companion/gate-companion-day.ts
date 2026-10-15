/**
 * Single-day companion category gate (Lab + production share).
 * Principle-only: absolute bans + emptiness. No phrase-keyword micromanagement —
 * mid/late window wording varies by model; that stays human review / prompt duty.
 */

import type { CompanionDayCards } from "./types";
import { assessCompanionEvidenceSlot } from "./companion-evidence-slot";
import {
  COMPANION_INVENTED_PARTNER_CHART_RULE_ID,
  companionInventedPartnerChartGateDetail,
  findInventedPartnerChartOnSoloPath,
} from "@/lib/llm/pro/delivery/pipeline-v3/invented-partner-chart";

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
  /** #13: when solo/absent (or relation_boundary says no partner chart). */
  partner_bazi?: "absent" | "present" | null;
  pivot_chart_path?: "solo" | "dyad" | null;
  relation_boundary?: string | null;
}): CompanionDayGateResult {
  const { cards } = input;
  const evidenceFail = assessCompanionEvidenceSlot(cards.evidence);
  if (evidenceFail) {
    return {
      passed: false,
      failed_rule: evidenceFail.failed_rule,
      detail: evidenceFail.detail,
    };
  }

  const allFace = [
    cards.today_is,
    cards.suitable,
    cards.unsuitable,
    cards.suggestion,
    cards.evidence,
  ].join("\n");

  const partnerHit = findInventedPartnerChartOnSoloPath(allFace, {
    partner_bazi: input.partner_bazi,
    pivot_chart_path: input.pivot_chart_path,
    relation_boundary: input.relation_boundary,
  });
  if (partnerHit) {
    return {
      passed: false,
      failed_rule: COMPANION_INVENTED_PARTNER_CHART_RULE_ID,
      detail: companionInventedPartnerChartGateDetail(partnerHit),
    };
  }

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
