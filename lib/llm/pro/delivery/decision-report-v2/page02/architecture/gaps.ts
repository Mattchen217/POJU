/**
 * Page02 data-gap vocabulary — architecture-first Batch 1.
 * Distinct from DC FactStatus; used for page/section/field-level missing_inputs.
 */

import type { Page02SectionId } from "./sections";

export const PAGE02_GAP_STATUSES = [
  "missing",
  "unknown",
  "conflict",
  "unverified",
  "declined",
  "not_applicable",
] as const;

export type Page02GapStatus = (typeof PAGE02_GAP_STATUSES)[number];

export type Page02MissingInput = {
  gap_id: string;
  page_id: "02";
  section_id: Page02SectionId;
  field_id: string;
  status: Page02GapStatus;
  /** Why this field is needed for the report. */
  why_needed: string;
  /** Which report content is affected. */
  affects_content: string;
  /** Hint for later DI2 / intake — not executed in this batch. */
  follow_up_collect_hint: string;
  /** Deterministic rule when generating with this gap. */
  handling:
    | "omit_section_content"
    | "defer_generation"
    | "generate_conditional_only"
    | "show_gap_note_only";
};

export type Page02GenerationStatus =
  | "blocked_on_required_inputs"
  | "ready_for_generation"
  | "generated_with_gaps"
  | "generated_complete"
  | "failed_structure"
  | "incomplete";

export function isPage02GapStatus(value: unknown): value is Page02GapStatus {
  return (
    typeof value === "string" &&
    (PAGE02_GAP_STATUSES as readonly string[]).includes(value)
  );
}

/** Map DC fact status → page gap status (never upgrades). */
export function gapStatusFromDcFactStatus(
  status: string | null | undefined,
): Page02GapStatus | null {
  switch ((status ?? "").trim()) {
    case "confirmed":
      return null;
    case "unverified":
      return "unverified";
    case "unknown":
      return "unknown";
    case "declined":
      return "declined";
    case "not_applicable":
      return "not_applicable";
    default:
      return "missing";
  }
}
