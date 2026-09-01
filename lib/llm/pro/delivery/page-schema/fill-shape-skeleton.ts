/**
 * Zero-narrative JSON shape anchors for page-schema fill.
 * Fields + empty placeholders only — no names, numbers, colors, directions, or plot.
 *
 * Used by fill-prompt when DELIVERY_FILL_SHAPE_MODE=skeleton (Gate 0).
 * Do NOT copy fixture prose here; do NOT reintroduce case drama.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

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

/** Per-page minimal shape for fill system (keys + empties). */
export const DELIVERY_FILL_SHAPE_SKELETON: Partial<
  Record<DeliverySegmentKey, Record<string, unknown>>
> = {
  direct_answer: {
    page: "direct_answer",
    page_title: "",
    page_subtitle: "",
    core_judgment: "",
    primary: emptyTrack("primary"),
    backup: emptyTrack("backup"),
    evidence: [],
  },
  foundation: {
    page: "foundation",
    page_title: "",
    page_subtitle: "",
    dashboard: [
      { key: "body", label: "", score: null, note: "" },
      { key: "mind", label: "", score: null, note: "" },
      { key: "field", label: "", score: null, note: "" },
    ],
    why_cards: [emptyWhyCard(), emptyWhyCard(), emptyWhyCard(), emptyWhyCard()],
    evidence: [],
  },
  science_action: {
    page: "science_action",
    page_title: "",
    page_subtitle: "",
    primary_toolkit: emptyToolkit("primary"),
    backup_toolkit: emptyToolkit("backup"),
    evidence: [],
  },
  metaphysics_action: {
    page: "metaphysics_action",
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
    page: "risk_guard",
    page_title: "",
    page_subtitle: "",
    red_lights: [emptyRisk(), emptyRisk()],
    traps: [emptyRisk()],
    switch_to_backup: emptyRisk(),
    protection_rules: [emptyRisk(), emptyRisk()],
    evidence: [],
  },
  signals_close: {
    page: "signals_close",
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
    takeaways: ["", "", ""],
    evidence: [],
  },
};

export function fillShapeSkeletonForKey(
  key: DeliverySegmentKey,
): Record<string, unknown> | null {
  const s = DELIVERY_FILL_SHAPE_SKELETON[key];
  return s ? structuredClone(s) : null;
}
