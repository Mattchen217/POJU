/**
 * Page06 per-section content norms — Strategy Execution vernacular body.
 */

import type { Page06SectionId } from "./sections";

export type Page06ContentKind =
  | "first_step"
  | "execution_action"
  | "validation_experiment"
  | "personal_adjustment"
  | "phase"
  | "resource_boundary"
  | "evidence_boundary";

export type Page06SectionContentSpec = {
  section_id: Page06SectionId;
  purpose: string;
  user_should_understand: string;
  content_boundary: string;
  language_style: string;
  length_guidance: string;
  must_include: readonly string[];
  must_not_include: readonly string[];
  allowed_unit_kinds: readonly Page06ContentKind[];
};

export const PAGE06_SECTION_CONTENT_SPECS: readonly Page06SectionContentSpec[] =
  [
    {
      section_id: "first_step",
      purpose: "Name the first observable move on the primary Page05 path.",
      user_should_understand:
        "What to do first, why now, what it needs, and what result would be visible.",
      content_boundary:
        "Execute a path Page05 already chose. Do not invent a new path or restate Page05 comparison.",
      language_style: "Concrete vernacular; no raw metaphysics jargon.",
      length_guidance: "One first_step bound to primary_path_id.",
      must_include: [
        "action_id + path_id = primary_path_id",
        "what / why_now / expected_observable_result",
        "claim_ids",
      ],
      must_not_include: [
        "A path_id outside Page05",
        "Page05 full comparison restatement",
        "Invented scores or success probabilities",
        "Page08 monitoring essay",
      ],
      allowed_unit_kinds: ["first_step"],
    },
    {
      section_id: "execution_actions",
      purpose: "Sequence the moves that carry the chosen path.",
      user_should_understand:
        "Order, dependencies, resources, guardrails, and the observable result of each action.",
      content_boundary: "Every path_id must already exist on Page05.",
      language_style: "Actionable, short, observable.",
      length_guidance: "1–8 ordered actions.",
      must_include: [
        "action_id unique",
        "sequence",
        "observable_result",
        "claim_ids",
      ],
      must_not_include: [
        "New strategy paths",
        "Checklist homework with no observable result",
        "P3 tool-word essays",
      ],
      allowed_unit_kinds: ["execution_action"],
    },
    {
      section_id: "validation_experiments",
      purpose: "Test a hypothesis inside a time window — or say none is warranted.",
      user_should_understand:
        "Hypothesis, action, what to observe, window, success, if-fail, and deferred cost — or why there is no experiment.",
      content_boundary:
        "Zero experiments is valid only with experiments_absent_note. Never invent an experiment to pad.",
      language_style: "Conditional; windowed.",
      length_guidance: "0–4 experiments.",
      must_include: [
        "Either an experiment with window + success_criteria + if_fail OR experiments_absent_note",
      ],
      must_not_include: [
        "Fabricated experiment",
        "Invented numeric success rate",
        "Page07 field essay",
      ],
      allowed_unit_kinds: ["validation_experiment"],
    },
    {
      section_id: "personal_execution_adjustments",
      purpose: "Change how this person executes, using personal units or reality facts.",
      user_should_understand:
        "What to adjust, and which existing personal unit or reality fact supports it.",
      content_boundary:
        "Each adjustment must cite supporting_personal_unit_refs and/or supporting_reality_fact_ids that exist. Empty section is allowed.",
      language_style: "Specific to this person; no generic coaching.",
      length_guidance: "0–4 adjustments.",
      must_include: [
        "When present: adjustment text plus at least one existing personal-unit ref or reality fact id",
        "claim_ids",
      ],
      must_not_include: [
        "Ungrounded self-help",
        "Invented personal traits",
        "Refs that are not in Page02 units or approved readings or DC facts",
      ],
      allowed_unit_kinds: ["personal_adjustment"],
    },
    {
      section_id: "phase_rhythm",
      purpose: "Mark when a phase starts and ends.",
      user_should_understand: "Enter triggers, exit triggers, and the goal of the phase.",
      content_boundary: "Rhythm, not a four-week plan.",
      language_style: "Trigger language.",
      length_guidance: "1–4 phases.",
      must_include: ["phase_id", "goal", "enter_triggers or exit_triggers"],
      must_not_include: ["Week-by-week gantt", "Invented calendar dates without a DC basis"],
      allowed_unit_kinds: ["phase"],
    },
    {
      section_id: "resource_boundaries",
      purpose: "State the time, money, people, and energy box, including unknowns.",
      user_should_understand:
        "What the execution may spend, and what is still unknown or missing.",
      content_boundary: "Unknown stays unknown.",
      language_style: "Plain limits.",
      length_guidance: "Four boundary strings plus optional other/unknown lists.",
      must_include: ["time", "money", "people", "energy"],
      must_not_include: [
        "Invented budgets",
        "Upgrading declined or unverified facts into confirmed limits",
      ],
      allowed_unit_kinds: ["resource_boundary"],
    },
    {
      section_id: "evidence_boundary",
      purpose: "Separate confirmed facts from hypotheses and publish the monitoring contract.",
      user_should_understand:
        "What is confirmed, what is still open, and which signals mean continue, adjust, stop, or rerun.",
      content_boundary:
        "monitoring_contract action_ids and experiment_ids must point at actions and experiments on this page. Page08 consumes this contract; do not write a second monitoring essay here.",
      language_style: "Boundary notes plus observable triggers.",
      length_guidance: "One monitoring contract plus uncertainty notes.",
      must_include: [
        "claim_ids",
        "uncertainty_notes",
        "observe_signals",
        "stop_triggers",
      ],
      must_not_include: [
        "Confirmed-fact ids that are not status=confirmed",
        "Page08 full review essay",
        "Scores or success percentages",
      ],
      allowed_unit_kinds: ["evidence_boundary"],
    },
  ];

export function page06ContentSpecForSection(
  sectionId: Page06SectionId,
): Page06SectionContentSpec | null {
  return (
    PAGE06_SECTION_CONTENT_SPECS.find((s) => s.section_id === sectionId) ?? null
  );
}
