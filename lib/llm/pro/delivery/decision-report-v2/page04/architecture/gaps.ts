/**
 * Page04 data-gap vocabulary — architecture Batch 1.
 */

import type { Page04SectionId } from "./sections";

export const PAGE04_GAP_STATUSES = [
  "missing",
  "unknown",
  "conflict",
  "unverified",
  "declined",
  "not_applicable",
] as const;

export type Page04GapStatus = (typeof PAGE04_GAP_STATUSES)[number];

export type Page04MissingInput = {
  gap_id: string;
  page_id: "04";
  section_id: Page04SectionId;
  field_id: string;
  status: Page04GapStatus;
  why_needed: string;
  affects_content: string;
  follow_up_collect_hint: string;
  handling:
    | "omit_section_content"
    | "defer_generation"
    | "generate_conditional_only"
    | "show_gap_note_only";
};

export type Page04GenerationStatus =
  | "blocked_on_required_inputs"
  | "ready_for_generation"
  | "generated_with_gaps"
  | "generated_complete"
  | "failed_structure"
  | "incomplete";

export function isPage04GapStatus(value: unknown): value is Page04GapStatus {
  return (
    typeof value === "string" &&
    (PAGE04_GAP_STATUSES as readonly string[]).includes(value)
  );
}

/** Map DC fact status → page gap status (never upgrades). */
export function gapStatusFromDcFactStatus(
  status: string | null | undefined,
): Page04GapStatus | null {
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
