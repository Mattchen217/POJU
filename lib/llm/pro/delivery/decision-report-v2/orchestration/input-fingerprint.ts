/**
 * Deterministic per-page input fingerprints — Batch 1 SSOT.
 * Uses sorted-key canonical JSON + SHA-256. Fail closed on incomplete inputs.
 */

import { canonicalJson } from "@/lib/poju/decision-context/normalize";
import { sha256Hex } from "@/lib/sha256";
import {
  pageFingerprintUpstreamIds,
  reportPageDefinition,
} from "./page-registry";
import { selectSharedSliceForPage } from "./shared-input-adapter";
import {
  REPORT_ORCHESTRATION_GRAPH_VERSION,
  REPORT_PAGE07_APPLICABILITY_STATUSES,
  REPORT_PAGE_IDS,
  type ReportFingerprintComputeResult,
  type ReportPage07ApplicabilityStatus,
  type ReportPageFingerprintInput,
  type ReportPageFingerprintResult,
  type ReportPageId,
  type ReportPageSharedInputSlice,
  type ReportUpstreamOutputFingerprints,
} from "./types";

const textEncoder = new TextEncoder();

export function hashCanonicalPayload(payload: unknown): string {
  const canonical = canonicalJson(payload);
  return sha256Hex(textEncoder.encode(canonical));
}

function isNonEmptyFingerprint(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isExplicitApplicability(
  value: unknown,
): value is ReportPage07ApplicabilityStatus {
  return (
    typeof value === "string" &&
    (REPORT_PAGE07_APPLICABILITY_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Pick only the upstream fingerprints this page is allowed to consume.
 * Does NOT fail on missing required upstream — use requireUpstreamFingerprintsForPage.
 */
export function selectUpstreamFingerprintsForPage(
  pageId: ReportPageId,
  all: ReportUpstreamOutputFingerprints,
): ReportUpstreamOutputFingerprints {
  const allowed = new Set(pageFingerprintUpstreamIds(pageId));
  const out: ReportUpstreamOutputFingerprints = {};
  for (const id of Object.keys(all).sort() as ReportPageId[]) {
    if (!allowed.has(id)) continue;
    const fp = all[id];
    if (isNonEmptyFingerprint(fp)) out[id] = fp.trim();
  }
  return out;
}

export type RequireUpstreamOk = {
  ok: true;
  upstream: ReportUpstreamOutputFingerprints;
};

export type RequireUpstreamFail = {
  ok: false;
  page_id: ReportPageId;
  code: string;
  detail: string;
  missing_upstream: ReportPageId[];
};

/**
 * Fail closed: every required upstream must have a non-empty fingerprint.
 */
export function requireUpstreamFingerprintsForPage(
  pageId: ReportPageId,
  all: ReportUpstreamOutputFingerprints,
): RequireUpstreamOk | RequireUpstreamFail {
  const required = pageFingerprintUpstreamIds(pageId);
  const missing: ReportPageId[] = [];
  const upstream: ReportUpstreamOutputFingerprints = {};
  for (const id of required) {
    const fp = all[id];
    if (!isNonEmptyFingerprint(fp)) {
      missing.push(id);
      continue;
    }
    upstream[id] = fp.trim();
  }
  // Ignore unrelated keys even if present.
  if (missing.length) {
    return {
      ok: false,
      page_id: pageId,
      code: "missing_required_upstream_fingerprint",
      detail: `page ${pageId} missing required upstream fingerprints: ${missing.join(", ")}`,
      missing_upstream: missing,
    };
  }
  return { ok: true, upstream };
}

/**
 * Build the deterministic fingerprint payload for one page.
 * Returns failure instead of hashing incomplete inputs.
 */
export function buildPageInputFingerprintPayload(
  input: ReportPageFingerprintInput,
):
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; page_id: ReportPageId; code: string; detail: string } {
  const def = reportPageDefinition(input.page_id);

  const sharedSel = selectSharedSliceForPage(input.page_id, input.shared_slice);
  if (!sharedSel.ok) {
    return {
      ok: false,
      page_id: input.page_id,
      code: sharedSel.code,
      detail: sharedSel.detail,
    };
  }

  const upReq = requireUpstreamFingerprintsForPage(
    input.page_id,
    input.upstream_output_fingerprints,
  );
  if (!upReq.ok) {
    return {
      ok: false,
      page_id: input.page_id,
      code: upReq.code,
      detail: upReq.detail,
    };
  }

  if (input.page_id === "07" || input.page_id === "08") {
    if (!isExplicitApplicability(input.page07_applicability_status)) {
      return {
        ok: false,
        page_id: input.page_id,
        code: "missing_page07_applicability_status",
        detail: `page ${input.page_id} requires explicit page07_applicability_status; got ${String(input.page07_applicability_status)}`,
      };
    }
  }

  const payload: Record<string, unknown> = {
    graph_version: REPORT_ORCHESTRATION_GRAPH_VERSION,
    page_id: input.page_id,
    output_schema_version: def.output_schema_version,
    prompt_version: def.prompt_version,
    production_version: input.production_version ?? def.production_version,
    validator_version: input.validator_version ?? def.validator_version,
    conditional: def.conditional,
    model_generation: def.model_generation,
    shared: sharedSel.slice,
    upstream_output_fingerprints: upReq.upstream,
  };
  if (input.page_id === "07" || input.page_id === "08") {
    payload.page07_applicability_status = input.page07_applicability_status;
  }
  return { ok: true, payload };
}

export function computePageInputFingerprint(
  input: ReportPageFingerprintInput,
): ReportFingerprintComputeResult {
  const built = buildPageInputFingerprintPayload(input);
  if (!built.ok) {
    return {
      ok: false,
      page_id: built.page_id,
      code: built.code,
      detail: built.detail,
    };
  }
  return {
    ok: true,
    result: {
      page_id: input.page_id,
      fingerprint: hashCanonicalPayload(built.payload),
      canonical_payload: built.payload,
    },
  };
}

/**
 * Compute fingerprints for pages that have complete inputs.
 * Pages with missing required upstream / applicability / shared fields are reported in errors
 * and omitted from results (fail closed — no partial fake fingerprint).
 */
export function computeAllPageInputFingerprints(input: {
  /** Per-page shared slices — must not be a single whole-job bag reused blindly. */
  shared_slices: Partial<Record<ReportPageId, ReportPageSharedInputSlice>>;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  page07_applicability_status?: ReportPage07ApplicabilityStatus | null;
  /** Optional per-page validator overrides (tests / staged bumps). */
  validator_version_overrides?: Partial<Record<ReportPageId, string>>;
  production_version_overrides?: Partial<Record<ReportPageId, string>>;
}): {
  results: Partial<Record<ReportPageId, ReportPageFingerprintResult>>;
  errors: Array<{ page_id: ReportPageId; code: string; detail: string }>;
} {
  const results: Partial<Record<ReportPageId, ReportPageFingerprintResult>> = {};
  const errors: Array<{ page_id: ReportPageId; code: string; detail: string }> =
    [];
  for (const page_id of REPORT_PAGE_IDS) {
    const slice = input.shared_slices[page_id];
    if (!slice) {
      errors.push({
        page_id,
        code: "missing_shared_slice",
        detail: `no shared_slice provided for page ${page_id}`,
      });
      continue;
    }
    const computed = computePageInputFingerprint({
      page_id,
      shared_slice: slice,
      upstream_output_fingerprints: input.upstream_output_fingerprints,
      page07_applicability_status: input.page07_applicability_status,
      validator_version: input.validator_version_overrides?.[page_id],
      production_version: input.production_version_overrides?.[page_id],
    });
    if (!computed.ok) {
      errors.push({
        page_id: computed.page_id,
        code: computed.code,
        detail: computed.detail,
      });
      continue;
    }
    results[page_id] = computed.result;
  }
  return { results, errors };
}
