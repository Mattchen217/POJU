/**
 * Deterministic per-page input fingerprints — Batch 1 SSOT.
 * Uses sorted-key canonical JSON + SHA-256. Fail closed on incomplete inputs.
 *
 * Production paths: computePageInputFingerprintFromProductionContext().
 */

import { canonicalJson } from "@/lib/poju/decision-context/normalize";
import { sha256Hex } from "@/lib/sha256";
import {
  pageFingerprintOptionalUpstreamIds,
  pageFingerprintUpstreamIds,
  reportPageDefinition,
} from "./page-registry";
import {
  applicabilityFromProductionContext,
  buildPageSharedInputFingerprintFromProductionContext,
  page02ConsumesPage01Alignment,
} from "./production-context-fingerprint";
import { selectSharedSliceForPage } from "./shared-input-adapter";
import type { Face02ProductionContext } from "../page02/production";
import {
  REPORT_OPTIONAL_UPSTREAM_ABSENT,
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
 * Pick only the required upstream fingerprints this page is allowed to consume.
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

/**
 * Optional upstream: present fingerprint or explicit "absent".
 * Never fails closed when optional is missing.
 */
export function selectOptionalUpstreamFingerprintsForPage(
  pageId: ReportPageId,
  all: ReportUpstreamOutputFingerprints,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of pageFingerprintOptionalUpstreamIds(pageId)) {
    const fp = all[id];
    out[id] = isNonEmptyFingerprint(fp)
      ? fp.trim()
      : REPORT_OPTIONAL_UPSTREAM_ABSENT;
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

  const optionalUpstream = selectOptionalUpstreamFingerprintsForPage(
    input.page_id,
    input.upstream_output_fingerprints,
  );

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
    optional_upstream_fingerprints: optionalUpstream,
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
 * Page02 optional←Page01 must match real context consumption.
 * Consumed alignment without Page01 output FP → reject.
 * No alignment but Page01 output FP provided → reject.
 * Never invent a Page01 output fingerprint.
 */
export function assertPage02OptionalUpstreamConsistency(input: {
  production_context: unknown;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
}):
  | { ok: true }
  | { ok: false; code: "optional_upstream_context_mismatch"; detail: string } {
  const ctx = input.production_context as Face02ProductionContext;
  const consumed = page02ConsumesPage01Alignment(ctx);
  const upFp = input.upstream_output_fingerprints["01"];
  const hasUp = isNonEmptyFingerprint(upFp);
  if (consumed && !hasUp) {
    return {
      ok: false,
      code: "optional_upstream_context_mismatch",
      detail:
        "page 02 production context consumed Page01 alignment but upstream_output_fingerprints[01] is missing/empty",
    };
  }
  if (!consumed && hasUp) {
    return {
      ok: false,
      code: "optional_upstream_context_mismatch",
      detail:
        "page 02 production context did not consume Page01 alignment but upstream_output_fingerprints[01] was provided",
    };
  }
  return { ok: true };
}

/**
 * Canonical production path:
 * real FaceXXProductionContext → consumed slice → page input fingerprint.
 */
export function computePageInputFingerprintFromProductionContext(input: {
  page_id: ReportPageId;
  production_context: unknown;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  page07_applicability_status?: ReportPage07ApplicabilityStatus | null;
  validator_version?: string;
  production_version?: string;
}): ReportFingerprintComputeResult {
  const extracted = buildPageSharedInputFingerprintFromProductionContext(
    input.page_id,
    input.production_context,
  );
  if (!extracted.ok) {
    return {
      ok: false,
      page_id: extracted.page_id,
      code: extracted.code,
      detail: extracted.detail,
    };
  }

  if (input.page_id === "02") {
    const consistency = assertPage02OptionalUpstreamConsistency({
      production_context: input.production_context,
      upstream_output_fingerprints: input.upstream_output_fingerprints,
    });
    if (!consistency.ok) {
      return {
        ok: false,
        page_id: "02",
        code: consistency.code,
        detail: consistency.detail,
      };
    }
  }

  let applicability = input.page07_applicability_status;
  if (
    (input.page_id === "07" || input.page_id === "08") &&
    !isExplicitApplicability(applicability)
  ) {
    applicability = applicabilityFromProductionContext(
      input.page_id,
      input.production_context,
    );
  }

  return computePageInputFingerprint({
    page_id: input.page_id,
    shared_slice: extracted.extract.shared_slice,
    upstream_output_fingerprints: input.upstream_output_fingerprints,
    page07_applicability_status: applicability,
    validator_version: input.validator_version,
    production_version: input.production_version,
  });
}

/**
 * Compute fingerprints for pages that have complete inputs.
 * Pages with missing required upstream / applicability / shared fields are reported in errors
 * and omitted from results (fail closed — no partial fake fingerprint).
 */
export function computeAllPageInputFingerprints(input: {
  shared_slices: Partial<Record<ReportPageId, ReportPageSharedInputSlice>>;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  page07_applicability_status?: ReportPage07ApplicabilityStatus | null;
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
