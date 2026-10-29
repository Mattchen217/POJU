/**
 * Zero-narrative JSON shape anchors for page-schema fill.
 * Fields + empty placeholders only — no names, numbers, colors, directions, or plot.
 *
 * Used by fill-prompt when DELIVERY_FILL_SHAPE_MODE=skeleton (Gate 0).
 * Do NOT copy fixture prose here; do NOT reintroduce case drama.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { canonicalizeDeliverySegmentKey } from "@/lib/llm/pro/delivery/segment-key-alias";
import { faceFillShapeSkeleton } from "@/lib/llm/pro/delivery/page-schema/face-types";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_IDS } from "@/lib/llm/pro/delivery/page-feed-matrix";

const emptyAngle = () => ({
  name: "",
  strategy: "",
  means: [""],
  chart_anchors: [] as string[],
  hard_metrics: [] as string[],
});

const emptyTrack = (role: "primary" | "backup") => ({
  role,
  name: "",
  core_logic: "",
  why: "",
  when: "",
  chart_anchors: [] as string[],
  strategic_goal: "",
  leverage_chip: "",
  dims: { body: "unknown", mind: "unknown", field: "unknown" },
});

const emptyToolkit = (role: "primary" | "backup") => ({
  role,
  title: "",
  angles: [emptyAngle(), emptyAngle(), emptyAngle()],
});

const emptyRisk = () => ({
  situation: "",
  then_do: "",
  watch: "",
  forbid: "",
  narrative: "",
  chart_anchors: [] as string[],
});

const emptyWhyCard = () => ({
  title: "",
  surface: "",
  essence: "",
  chart_anchors: [] as string[],
});

const emptyDay7 = () => ({
  action: "",
  why: "",
  done_when: "",
  chart_anchors: [] as string[],
});

const emptyOption = () => ({
  name: "",
  summary: "",
  upside: "",
  cost: "",
  risk: "",
  reversibility: "",
  chart_anchors: [] as string[],
});

const emptyStrategyTrack = () => ({
  name: "",
  why: "",
  when: "",
  exit: "",
  chart_anchors: [] as string[],
});

/** Per-page minimal shape for fill system (v1 keys + empties). */
export const DELIVERY_FILL_SHAPE_SKELETON: Partial<
  Record<DeliverySegmentKey, Record<string, unknown>>
> = {
  decision_brief: {
    page: "decision_brief",
    page_title: "",
    page_subtitle: "",
    core_judgment: "",
    primary: emptyTrack("primary"),
    backup: emptyTrack("backup"),
    evidence: [],
  },
  situation_analysis: {
    page: "situation_analysis",
    page_title: "",
    page_subtitle: "",
    dashboard: [
      { key: "body", label: "", score: null, note: "" },
      { key: "mind", label: "", score: null, note: "" },
      { key: "field", label: "", score: null, note: "" },
    ],
    why_cards: [emptyWhyCard(), emptyWhyCard(), emptyWhyCard(), emptyWhyCard()],
    confirmed_facts: [""],
    open_assumptions: [""],
    info_gaps: [""],
    evidence: [],
  },
  personal_decision_patterns: {
    page: "personal_decision_patterns",
    page_title: "",
    page_subtitle: "",
    dashboard: [],
    why_cards: [emptyWhyCard()],
    evidence: [],
  },
  bottleneck_analysis: {
    page: "bottleneck_analysis",
    page_title: "",
    page_subtitle: "",
    dashboard: [],
    why_cards: [emptyWhyCard()],
    evidence: [],
  },
  strategic_options: {
    page: "strategic_options",
    page_title: "",
    page_subtitle: "",
    options: [emptyOption(), emptyOption()],
    evidence: [],
  },
  recommended_strategy: {
    page: "recommended_strategy",
    page_title: "",
    page_subtitle: "",
    core_judgment: "",
    primary: emptyStrategyTrack(),
    backup: emptyStrategyTrack(),
    evidence: [],
  },
  execution_guidance: {
    page: "execution_guidance",
    page_title: "",
    page_subtitle: "",
    primary_toolkit: emptyToolkit("primary"),
    backup_toolkit: emptyToolkit("backup"),
    self_retune: { title: "", body: "" },
    evidence: [],
  },
  self_regulation: {
    page: "self_regulation",
    page_title: "",
    page_subtitle: "",
    question_anchor: "",
    desired_outcome: "",
    dimensions: [emptyAngle(), emptyAngle(), emptyAngle()],
    leverage: [],
    avoid: [],
    field_matrix: [],
    evidence: [],
  },
  validation_risk: {
    page: "validation_risk",
    page_title: "",
    page_subtitle: "",
    red_lights: [emptyRisk(), emptyRisk()],
    traps: [emptyRisk()],
    switch_to_backup: emptyRisk(),
    protection_rules: [emptyRisk(), emptyRisk()],
    evidence: [],
  },
  validation_close: {
    page: "validation_close",
    page_title: "",
    page_subtitle: "",
    identity_before: "",
    identity_after: "",
    identity_shift: "",
    identity_shift_anchors: [],
    quote: "",
    quote_use: "",
    immediate_action: "",
    tonight_done_looks_like: "",
    tonight_why: "",
    tonight_anchors: [],
    day7_micro_actions: [emptyDay7(), emptyDay7(), emptyDay7(), emptyDay7()],
    watch_signals: ["", "", ""],
    takeaways: ["", "", ""],
    evidence: [],
  },
  // legacy six keys → same shapes as remapped v1 (read / transitional fills)
  direct_answer: {
    page: "decision_brief",
    page_title: "",
    page_subtitle: "",
    core_judgment: "",
    primary: emptyTrack("primary"),
    backup: emptyTrack("backup"),
    evidence: [],
  },
  foundation: {
    page: "situation_analysis",
    page_title: "",
    page_subtitle: "",
    dashboard: [
      { key: "body", label: "", score: null, note: "" },
      { key: "mind", label: "", score: null, note: "" },
      { key: "field", label: "", score: null, note: "" },
    ],
    why_cards: [emptyWhyCard(), emptyWhyCard(), emptyWhyCard(), emptyWhyCard()],
    confirmed_facts: [""],
    open_assumptions: [""],
    info_gaps: [""],
    evidence: [],
  },
  science_action: {
    page: "execution_guidance",
    page_title: "",
    page_subtitle: "",
    primary_toolkit: emptyToolkit("primary"),
    backup_toolkit: emptyToolkit("backup"),
    self_retune: { title: "", body: "" },
    evidence: [],
  },
  metaphysics_action: {
    page: "self_regulation",
    page_title: "",
    page_subtitle: "",
    question_anchor: "",
    desired_outcome: "",
    dimensions: [emptyAngle(), emptyAngle(), emptyAngle()],
    leverage: [],
    avoid: [],
    field_matrix: [],
    evidence: [],
  },
  risk_guard: {
    page: "validation_risk",
    page_title: "",
    page_subtitle: "",
    red_lights: [emptyRisk(), emptyRisk()],
    traps: [emptyRisk()],
    switch_to_backup: emptyRisk(),
    protection_rules: [emptyRisk(), emptyRisk()],
    evidence: [],
  },
  signals_close: {
    page: "validation_close",
    page_title: "",
    page_subtitle: "",
    identity_before: "",
    identity_after: "",
    identity_shift: "",
    identity_shift_anchors: [],
    quote: "",
    quote_use: "",
    immediate_action: "",
    tonight_done_looks_like: "",
    tonight_why: "",
    tonight_anchors: [],
    day7_micro_actions: [emptyDay7(), emptyDay7(), emptyDay7(), emptyDay7()],
    watch_signals: ["", "", ""],
    takeaways: ["", "", ""],
    evidence: [],
  },
};

export function fillShapeSkeletonForKey(
  key: DeliverySegmentKey,
): Record<string, unknown> | null {
  // New books: face-native empty shape (no primary/backup).
  if ((DECISION_PAGE_IDS as readonly string[]).includes(key)) {
    return structuredClone(faceFillShapeSkeleton(key as DecisionPageId));
  }
  const direct = DELIVERY_FILL_SHAPE_SKELETON[key];
  if (direct) return structuredClone(direct);
  const canon = canonicalizeDeliverySegmentKey(key);
  if (canon && (DECISION_PAGE_IDS as readonly string[]).includes(canon)) {
    return structuredClone(faceFillShapeSkeleton(canon as DecisionPageId));
  }
  if (canon && DELIVERY_FILL_SHAPE_SKELETON[canon]) {
    return structuredClone(DELIVERY_FILL_SHAPE_SKELETON[canon]!);
  }
  return null;
}
