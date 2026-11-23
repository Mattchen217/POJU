/**
 * Page05 per-section content norms — Feasible Paths vernacular body.
 */

import type { Page05SectionId } from "./sections";

export type Page05ContentKind =
  | "preferred_path"
  | "alternative_path"
  | "cautious_path"
  | "switching_rule"
  | "comparison_row";

export type Page05SectionContentSpec = {
  section_id: Page05SectionId;
  purpose: string;
  user_should_understand: string;
  content_boundary: string;
  language_style: string;
  length_guidance: string;
  must_include: readonly string[];
  must_not_include: readonly string[];
  allowed_unit_kinds: readonly Page05ContentKind[];
};

export const PAGE05_SECTION_CONTENT_SPECS: readonly Page05SectionContentSpec[] =
  [
    {
      section_id: "preferred_path",
      purpose: "Present the currently preferred feasible path with evidence.",
      user_should_understand:
        "What the first choice is, why now, what it needs, and what proves it.",
      content_boundary:
        "Expand Page01 into a comparable path — do not copy Page01 summary as body.",
      language_style: "Concrete vernacular; no raw metaphysics jargon.",
      length_guidance: "1 preferred path unit.",
      must_include: [
        "path_id + path_role=preferred",
        "prerequisites / resources / costs / risks / reversibility / success_signals",
        "claim_ids",
      ],
      must_not_include: [
        "Page01 full conclusion restatement",
        "Page06 detailed near-steps",
        "Invented scores or success probabilities",
        "Scare-fate language",
      ],
      allowed_unit_kinds: ["preferred_path"],
    },
    {
      section_id: "alternative_path",
      purpose: "Present real alternative path(s) with clear differences.",
      user_should_understand:
        "What else is executable, when it fits, and why it is not first now.",
      content_boundary: "Must differ substantively from preferred.",
      language_style: "Concrete contrast; no filler options.",
      length_guidance: "1–2 alternative path units.",
      must_include: [
        "path_role=alternative",
        "difference vs preferred",
        "claim_ids",
      ],
      must_not_include: [
        "Duplicate preferred wording",
        "Fake low-effort options with no feasibility",
        "Page07 field essay",
      ],
      allowed_unit_kinds: ["alternative_path"],
    },
    {
      section_id: "cautious_path",
      purpose: "Name over-committed / constraint-conflicting paths — or note absence.",
      user_should_understand:
        "What not to prioritize now, why, and when to reconsider — or that none exists.",
      content_boundary: "Never invent a cautious path to fill count.",
      language_style: "Conditional; explicit reconsideration conditions.",
      length_guidance: "0–1 cautious path; else cautious_absent_note.",
      must_include: [
        "Either cautious path with reconsideration_conditions OR cautious_absent_note",
      ],
      must_not_include: [
        "Fabricated cautious option",
        "Moral condemnation without DC grounding",
      ],
      allowed_unit_kinds: ["cautious_path"],
    },
    {
      section_id: "switching_exit",
      purpose: "Observable switch / stop / pause / redefine rules.",
      user_should_understand:
        "From which path, under what signal, to which action/target, and why.",
      content_boundary: "Rules must cite source_path_id; switch needs real target.",
      language_style: "Observable triggers; no vague 'adjust when bad'.",
      length_guidance: "1–8 rules covering switch and at least one stop/redefine.",
      must_include: [
        "source_path_id",
        "trigger_condition",
        "action",
        "claim_ids",
      ],
      must_not_include: [
        "Orphan target_path_id",
        "Page08 full monitoring essay",
        "Invented numeric thresholds without DC basis",
      ],
      allowed_unit_kinds: ["switching_rule"],
    },
    {
      section_id: "path_comparison",
      purpose: "Side-by-side qualitative comparison of paths.",
      user_should_understand:
        "Relative benefit/cost/risk/resources/reversibility/prerequisites.",
      content_boundary: "No unsourced scores or success probabilities.",
      language_style: "Short comparative phrases tied to path_id.",
      length_guidance: "One row per path_unit.",
      must_include: [
        "row per path_id",
        "benefit/cost/risk/resource_requirement/reversibility/prerequisites",
      ],
      must_not_include: [
        "87/92 style scores",
        "Invented success %",
        "Paths not in path_units",
      ],
      allowed_unit_kinds: ["comparison_row"],
    },
  ];

export function page05ContentSpecForSection(
  sectionId: Page05SectionId,
): Page05SectionContentSpec | null {
  return (
    PAGE05_SECTION_CONTENT_SPECS.find((s) => s.section_id === sectionId) ?? null
  );
}
