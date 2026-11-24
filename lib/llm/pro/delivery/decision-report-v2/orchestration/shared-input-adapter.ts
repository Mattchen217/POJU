/**
 * Per-page shared-input fingerprint adapters.
 *
 * Aligns with buildFaceXXProductionContext consumption:
 * - Each face seeds its own registry (serves_face filter) and relevance-selected facts/readings.
 * - Page01/02 personal slice may include ziwei; Page04–08 builders pass ziwei=null.
 * - Callers must pre-hash the *filtered* slice for the target page.
 * - This module never hashes a whole-job registry/readings bag into every page.
 */

import { pageSharedInputKeys, reportPageDefinition } from "./page-registry";
import type {
  ReportPageId,
  ReportPageSharedInputSlice,
  ReportSharedInputKey,
} from "./types";

export type SharedSliceSelectOk = {
  ok: true;
  /** Only keys declared for this page, in stable key order. */
  slice: Record<string, string>;
};

export type SharedSliceSelectFail = {
  ok: false;
  page_id: ReportPageId;
  code: string;
  detail: string;
};

export type SharedSliceSelectResult = SharedSliceSelectOk | SharedSliceSelectFail;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Select and validate the shared-input keys this page actually consumes.
 * Fail closed on missing / empty required fields.
 */
export function selectSharedSliceForPage(
  pageId: ReportPageId,
  slice: Partial<ReportPageSharedInputSlice> | ReportPageSharedInputSlice,
): SharedSliceSelectResult {
  const keys = pageSharedInputKeys(pageId);
  const out: Record<string, string> = {};
  const missing: ReportSharedInputKey[] = [];
  for (const key of keys) {
    const raw = slice[key];
    if (!isNonEmptyString(raw)) {
      missing.push(key);
      continue;
    }
    out[key] = raw.trim();
  }
  if (missing.length) {
    return {
      ok: false,
      page_id: pageId,
      code: "missing_shared_input_slice_field",
      detail: `page ${pageId} missing shared slice fields: ${missing.join(", ")}`,
    };
  }
  return { ok: true, slice: out };
}

/**
 * Documented consumption notes for Batch 2 workers building real slices.
 * Does not execute production builders.
 */
export function pageSharedInputConsumptionNotes(pageId: ReportPageId): string {
  return reportPageDefinition(pageId).notes ?? "";
}

/** Stable empty-ish helper for tests that need a complete valid slice. */
export function makeTestSharedSlice(
  overrides: Partial<ReportPageSharedInputSlice> = {},
): ReportPageSharedInputSlice {
  return {
    locale: overrides.locale ?? "en",
    dc_slice_fingerprint: overrides.dc_slice_fingerprint ?? "dc_slice_default",
    personal_computation_slice_fingerprint:
      overrides.personal_computation_slice_fingerprint ?? "personal_slice_default",
    approved_readings_slice_fingerprint:
      overrides.approved_readings_slice_fingerprint ?? "readings_slice_default",
    evidence_registry_slice_fingerprint:
      overrides.evidence_registry_slice_fingerprint ?? "registry_slice_default",
  };
}
