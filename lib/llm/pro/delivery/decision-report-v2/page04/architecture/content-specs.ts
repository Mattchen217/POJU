/**
 * Page04 per-section content norms — Core Bottleneck vernacular body.
 */

import type { Page04SectionId } from "./sections";

export type Page04ContentKind =
  | "bottleneck_label"
  | "manifestation"
  | "force_through_cost"
  | "leverage_point"
  | "evidence_note";

export type Page04SectionContentSpec = {
  section_id: Page04SectionId;
  purpose: string;
  user_should_understand: string;
  content_boundary: string;
  language_style: string;
  length_guidance: string;
  must_include: readonly string[];
  must_not_include: readonly string[];
  allowed_unit_kinds: readonly Page04ContentKind[];
};

export const PAGE04_SECTION_CONTENT_SPECS: readonly Page04SectionContentSpec[] =
  [
    {
      section_id: "bottleneck_naming",
      purpose: "Name the core obstacle(s) blocking resolution of this decision.",
      user_should_understand:
        "Which 1–3 evidenced bottlenecks matter most — not a personality label dump.",
      content_boundary:
        "Naming only; no Page01 verdict copy, no path ranking, no action plans.",
      language_style: "Plain concrete vernacular; no raw metaphysics jargon.",
      length_guidance: "1–3 short label units.",
      must_include: [
        "Concrete obstacle naming tied to this decision",
        "claim_ids when a unit is present",
      ],
      must_not_include: [
        "Page01 full conclusion restatement",
        "Page05 option comparison",
        "Page06/07 execution steps",
        "Invented ungrounded personality tags",
        "Scare-fate language",
      ],
      allowed_unit_kinds: ["bottleneck_label"],
    },
    {
      section_id: "manifestation",
      purpose: "Show how the bottleneck appears in the user's real situation.",
      user_should_understand:
        "How the obstacle shows up in scenes/results affecting this decision.",
      content_boundary:
        "Confirmed DC facts stay confirmed; unverified stay conditional.",
      language_style: "Scene/result vernacular; mark inference explicitly.",
      length_guidance: "1–6 units aligned to named bottlenecks.",
      must_include: [
        "Link to this decision's reality when facts exist",
        "Distinguish confirmed vs inferred",
      ],
      must_not_include: [
        "Upgrading unverified/unknown/declined to confirmed",
        "Inventing user biography",
        "Page02 full foundation restatement",
        "Path/strategy prescriptions",
      ],
      allowed_unit_kinds: ["manifestation"],
    },
    {
      section_id: "force_through_cost",
      purpose: "State conditional costs if the old pattern continues.",
      user_should_understand:
        "What may be at stake (time/money/options/relations/energy) if unchanged.",
      content_boundary: "Conditional risk only — never inevitable doom.",
      language_style: "Conditional; no scare-fate or paid-remedy pitch.",
      length_guidance: "1–4 short units.",
      must_include: ["Conditional cost/risk framing"],
      must_not_include: [
        "Inevitable disaster language",
        "Page08 red-light closing",
        "Action Gantt / 30-day checklist",
      ],
      allowed_unit_kinds: ["force_through_cost"],
    },
    {
      section_id: "leverage_point",
      purpose: "Point at the highest-leverage condition/mechanism to change first.",
      user_should_understand:
        "What to pry first, and what is controllable vs not — without ranking paths.",
      content_boundary:
        "Leverage diagnosis only; not Page05 ranking or Page06 near-step plans.",
      language_style: "Concrete mechanism vernacular.",
      length_guidance: "1–3 units.",
      must_include: [
        "One priority lever direction",
        "Controllable vs not-yet-controllable when relevant",
      ],
      must_not_include: [
        "Full strategic option comparison (Page05)",
        "Near-step / experiment plans (Page06)",
        "Field/relationship Page07 content",
      ],
      allowed_unit_kinds: ["leverage_point"],
    },
    {
      section_id: "evidence_boundary",
      purpose: "Hold evidence pointers, hypotheses, and gap notes — not a second body.",
      user_should_understand:
        "What is evidenced vs gap/hypothesis; gaps are not confirmed facts.",
      content_boundary: "Boundary/fold only; no fake evidence minting.",
      language_style: "Short notes; program owns gap status.",
      length_guidance: "0–6 evidence_note units + gap lines.",
      must_include: [
        "uncertainty or gap notes when inputs are incomplete",
        "No status upgrades",
      ],
      must_not_include: [
        "Invented claim/evidence associations",
        "Treating declined/unknown as confirmed",
        "Raw metaphysics proper nouns in user-visible body",
      ],
      allowed_unit_kinds: ["evidence_note"],
    },
  ] as const;

export function page04ContentSpecForSection(
  sectionId: Page04SectionId,
): Page04SectionContentSpec | null {
  return (
    PAGE04_SECTION_CONTENT_SPECS.find((s) => s.section_id === sectionId) ?? null
  );
}
