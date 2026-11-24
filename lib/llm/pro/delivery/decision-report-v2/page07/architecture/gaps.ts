/**
 * Page07 data-gap vocabulary — architecture Batch 1.
 */

import type { Page07SectionId } from "./sections";

export const PAGE07_GAP_STATUSES = [
  "missing",
  "unknown",
  "conflict",
  "unverified",
  "declined",
  "not_applicable",
] as const;

export type Page07GapStatus = (typeof PAGE07_GAP_STATUSES)[number];

export type Page07MissingInput = {
  gap_id: string;
  page_id: "07";
  section_id: Page07SectionId;
  field_id: string;
  status: Page07GapStatus;
  why_needed: string;
  affects_content: string;
  follow_up_collect_hint: string;
  handling:
    | "omit_section_content"
    | "defer_generation"
    | "generate_conditional_only"
    | "show_gap_note_only";
};

export type Page07GenerationStatus =
  | "blocked_on_required_inputs"
  | "ready_for_generation"
  | "generated_with_gaps"
  | "generated_complete"
  | "failed_structure"
  | "incomplete"
  | "skipped_not_applicable"
  | "insufficient_information";

export function isPage07GapStatus(value: unknown): value is Page07GapStatus {
  return (
    typeof value === "string" &&
    (PAGE07_GAP_STATUSES as readonly string[]).includes(value)
  );
}

export function gapStatusFromDcFactStatus(
  status: string | null | undefined,
): Page07GapStatus | null {
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
