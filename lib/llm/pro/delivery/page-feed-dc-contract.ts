/**
 * S1 PageFeed ↔ Decision Context contract.
 * Documents which frozen-DC fields each face may consume.
 * Does NOT invent facts; PageFeed only projects declared fields.
 */

import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import {
  pageReceivesDecisionContextFeed,
  STAGE4_DC_FEED_PAGES,
} from "@/lib/poju/decision-context/dc-page-feed";

export type DcFeedFieldKey =
  | "binding"
  | "definition"
  | "confirmed_facts"
  | "unverified_or_estimate_facts"
  | "unknowns_and_boundaries"
  | "constraints"
  | "hypotheses"
  | "dirs"
  | "conflicts"
  | "delivery_mode"
  | "stage4_rules";

/** Per-face allowlist of DC projection fields (formal only). */
export const PAGE_DC_FIELD_ALLOWLIST: Record<
  DecisionPageId,
  readonly DcFeedFieldKey[] | null
> = {
  "01": [
    "binding",
    "definition",
    "confirmed_facts",
    "unverified_or_estimate_facts",
    "constraints",
    "unknowns_and_boundaries",
    "conflicts",
    "delivery_mode",
    "stage4_rules",
  ],
  "02": [
    "binding",
    "definition",
    "confirmed_facts",
    "hypotheses",
    "dirs",
    "conflicts",
    "stage4_rules",
  ],
  "03": null,
  "04": [
    "binding",
    "confirmed_facts",
    "constraints",
    "hypotheses",
    "dirs",
    "conflicts",
    "unknowns_and_boundaries",
    "stage4_rules",
  ],
  "05": [
    "binding",
    "definition",
    "confirmed_facts",
    "unverified_or_estimate_facts",
    "constraints",
    "hypotheses",
    "dirs",
    "conflicts",
    "unknowns_and_boundaries",
    "delivery_mode",
    "stage4_rules",
  ],
  "06": [
    "binding",
    "hypotheses",
    "constraints",
    "confirmed_facts",
    "unknowns_and_boundaries",
    "dirs",
    "stage4_rules",
  ],
  "07": null,
  "08": [
    "binding",
    "hypotheses",
    "constraints",
    "dirs",
    "conflicts",
    "unknowns_and_boundaries",
    "stage4_rules",
  ],
};

export function dcFieldsForPage(pageId: DecisionPageId): readonly DcFeedFieldKey[] | null {
  return PAGE_DC_FIELD_ALLOWLIST[pageId];
}

export function faceRequiresFormalDecisionContext(pageId: string): boolean {
  return pageReceivesDecisionContextFeed(pageId);
}

export function listDecisionContextFeedPages(): readonly DecisionPageId[] {
  return STAGE4_DC_FEED_PAGES;
}

/**
 * Display policy for missing / unknown / conflict — never upgrade to confirmed.
 */
export const PAGE_DC_DISPLAY_POLICY = {
  missing_field: "omit_or_boundary_note",
  unknown: "show_as_unknown_not_confirmed",
  conflict_open_or_unresolved: "condition_or_demote_preferred_path",
  hypothesis: "never_upgrade_to_fact",
  superseded_binding: "refuse_or_require_explicit_version",
} as const;
