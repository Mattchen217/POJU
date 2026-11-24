/**
 * Page08 data-gap vocabulary — architecture Batch 1.
 */

import type { Page08SectionId } from "./sections";

export const PAGE08_GAP_STATUSES = [
  "missing",
  "unknown",
  "conflict",
  "unverified",
  "declined",
  "not_applicable",
] as const;

export type Page08GapStatus = (typeof PAGE08_GAP_STATUSES)[number];

export type Page08MissingInput = {
  gap_id: string;
  page_id: "08";
  section_id: Page08SectionId;
  field_id: string;
  status: Page08GapStatus;
  why_needed: string;
  affects_content: string;
  follow_up_collect_hint: string;
  handling:
    | "omit_section_content"
    | "defer_generation"
    | "generate_conditional_only"
    | "show_gap_note_only";
};

export type Page08GenerationStatus =
  | "blocked_on_required_inputs"
  | "ready_for_generation"
  | "generated_with_gaps"
  | "generated_complete"
  | "failed_structure"
  | "incomplete";

export function isPage08GapStatus(value: unknown): value is Page08GapStatus {
  return (
    typeof value === "string" &&
    (PAGE08_GAP_STATUSES as readonly string[]).includes(value)
  );
}

export function gapStatusFromDcFactStatus(
  status: string | null | undefined,
): Page08GapStatus | null {
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
