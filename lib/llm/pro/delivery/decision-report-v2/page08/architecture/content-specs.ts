/**
 * Page08 per-section content norms — observe signals, then continue / adjust / pause / stop / reassess.
 */

import type { Page08SectionId } from "./sections";

export type Page08ContentKind =
  | "risk"
  | "observation_signal"
  | "trigger"
  | "reassessment"
  | "evidence_boundary";

export type Page08SectionContentSpec = {
  section_id: Page08SectionId;
  purpose: string;
  user_should_understand: string;
  content_boundary: string;
  language_style: string;
  length_guidance: string;
  must_include: readonly string[];
  must_not_include: readonly string[];
  allowed_unit_kinds: readonly Page08ContentKind[];
};

export const PAGE08_SECTION_CONTENT_SPECS: readonly Page08SectionContentSpec[] =
  [
    {
      section_id: "risks",
      purpose:
        "Name execution, resource, dependency, relationship, assumption, or information risks already supported by the payload.",
      user_should_understand:
        "Which risks are active, potential, unverified, or resolved, and which existing path or action they touch.",
      content_boundary:
        "related_path_ids must already exist on Page05. related_action_ids must already exist on Page06. Do not rewrite the Page01 recommendation.",
      language_style: "Concrete vernacular. No scores or probabilities.",
      length_guidance: "1–8 risks. Each cites at least one registry claim.",
      must_include: [
        "risk_id, risk_title, risk_description",
        "risk_category and current_status",
        "claim_ids from the Page08 registry",
      ],
      must_not_include: [
        "A new path or a rewritten Page05 ranking",
        "Invented facts, scores, probabilities, or calendar dates",
        "legacy_ id prefixes",
      ],
      allowed_unit_kinds: ["risk"],
    },
    {
      section_id: "observation_signals",
      purpose:
        "Say what to watch for each risk, from which source, by which method, and over which window.",
      user_should_understand:
        "Whether a baseline and a threshold already exist, or still need to be established.",
      content_boundary:
        "Every signal must cite related_risk_ids that exist on this page. Prefer Page06 monitoring_contract observe_signals as the source, without copying them into a new plan.",
      language_style: "Observable and specific.",
      length_guidance: "1–8 signals. One signal may watch more than one risk.",
      must_include: [
        "signal_name, what_to_observe, observation_source, observation_method, observation_window",
        "baseline_status has_baseline | needs_baseline | no_basis",
        "threshold_status defined | not_defined",
      ],
      must_not_include: [
        "A signal with no risk",
        "A numeric score or success probability",
        "A date that is not already in the payload",
      ],
      allowed_unit_kinds: ["observation_signal"],
    },
    {
      section_id: "triggers",
      purpose:
        "When the named signal meets a condition, choose continue, adjust, pause, stop, or reassess.",
      user_should_understand:
        "What would change the decision response, and which evidence is still required.",
      content_boundary:
        "related_risk_ids and related_signal_ids must already exist on this page. Paths and actions must already exist upstream.",
      language_style: "Conditional. decision_response is one of the five allowed words.",
      length_guidance: "1–8 triggers.",
      must_include: [
        "trigger_condition",
        "trigger_status defined | pending_confirmation | conditional",
        "decision_response continue | adjust | pause | stop | reassess",
      ],
      must_not_include: [
        "A sixth response such as rerun or a new recommendation",
        "A trigger that cites a missing risk or signal",
        "Invented Page06 actions",
      ],
      allowed_unit_kinds: ["trigger"],
    },
    {
      section_id: "reassessment_conditions",
      purpose:
        "State which change would require another look, and the review scope. Empty is allowed.",
      user_should_understand:
        "Reassessment is a review of the existing decision, not a replacement plan.",
      content_boundary:
        "affected_path_ids must already exist on Page05. Do not invent a new main decision.",
      language_style: "Conditional.",
      length_guidance: "0–6 conditions.",
      must_include: [
        "When present: condition, change_type, expected_review_scope",
      ],
      must_not_include: [
        "A rewritten Page01 judgment",
        "A new path id",
      ],
      allowed_unit_kinds: ["reassessment"],
    },
    {
      section_id: "evidence_boundary",
      purpose:
        "Separate confirmed facts from unverified facts, and state monitoring and reassessment limits.",
      user_should_understand:
        "What is confirmed, what is only unverified, and what this page cannot decide.",
      content_boundary:
        "confirmed_fact_ids may list only DC facts with status=confirmed. unverified_fact_ids may list only status=unverified.",
      language_style: "Boundary language.",
      length_guidance: "monitoring_limitations required.",
      must_include: [
        "related_claim_ids",
        "monitoring_limitations",
        "confirmed_fact_ids and unverified_fact_ids kept distinct",
      ],
      must_not_include: [
        "Upgrading an unverified fact to confirmed",
        "Scores, probabilities, or invented dates",
      ],
      allowed_unit_kinds: ["evidence_boundary"],
    },
  ];

export function page08ContentSpecForSection(
  sectionId: Page08SectionId,
): Page08SectionContentSpec | null {
  return (
    PAGE08_SECTION_CONTENT_SPECS.find((s) => s.section_id === sectionId) ??
    null
  );
}
