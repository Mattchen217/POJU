/**
 * Per-page shared-input selection / validation.
 *
 * Production paths MUST obtain slices via
 * buildPageSharedInputFingerprintFromProductionContext() — this module only
 * validates that a slice contains the page's declared keys.
 *
 * makeTestSharedSlice() is a unit-test helper for version/upstream isolation
 * tests only; it is NOT a production input source.
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

/**
 * Unit-test helper ONLY — fills declared keys with opaque strings.
 * Must not be used as a stand-in for production-context adapters when
 * proving real consumption isolation.
 */
export function makeTestSharedSlice(
  pageId: ReportPageId,
  overrides: Partial<Record<ReportSharedInputKey, string>> = {},
): ReportPageSharedInputSlice {
  const keys = pageSharedInputKeys(pageId);
  const out: ReportPageSharedInputSlice = {
    locale: overrides.locale ?? "en",
  };
  for (const key of keys) {
    if (key === "locale") continue;
    out[key] =
      overrides[key] ?? `test_${pageId}_${key}_opaque_not_production`;
  }
  return out;
}
