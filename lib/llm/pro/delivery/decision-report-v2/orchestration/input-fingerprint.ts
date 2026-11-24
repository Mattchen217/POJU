/**
 * Deterministic per-page input fingerprints — Batch 1 SSOT.
 * Uses sorted-key canonical JSON + SHA-256. No unstable Object key walks.
 */

import { canonicalJson } from "@/lib/poju/decision-context/normalize";
import { sha256Hex } from "@/lib/sha256";
import {
  pageFingerprintUpstreamIds,
  reportPageDefinition,
} from "./page-registry";
import {
  REPORT_ORCHESTRATION_GRAPH_VERSION,
  type ReportPageFingerprintInput,
  type ReportPageFingerprintResult,
  type ReportPageId,
  type ReportSharedInputSnapshot,
  type ReportUpstreamOutputFingerprints,
} from "./types";

const textEncoder = new TextEncoder();

export function hashCanonicalPayload(payload: unknown): string {
  const canonical = canonicalJson(payload);
  return sha256Hex(textEncoder.encode(canonical));
}

/**
 * Pick only the upstream fingerprints this page is allowed to consume.
 * Omitting unrelated pages prevents cascading invalidations.
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
    if (typeof fp === "string" && fp.trim()) out[id] = fp.trim();
  }
  return out;
}

function sharedSlice(shared: ReportSharedInputSnapshot): Record<string, string> {
  return {
    locale: shared.locale,
    dc_snapshot_fingerprint: shared.dc_snapshot_fingerprint,
    personal_computation_fingerprint: shared.personal_computation_fingerprint,
    approved_readings_fingerprint: shared.approved_readings_fingerprint,
    evidence_registry_fingerprint: shared.evidence_registry_fingerprint,
  };
}

/**
 * Build the deterministic fingerprint payload for one page.
 * Unrelated upstream pages are excluded even if present in the input bag.
 */
export function buildPageInputFingerprintPayload(
  input: ReportPageFingerprintInput,
): Record<string, unknown> {
  const def = reportPageDefinition(input.page_id);
  const upstream = selectUpstreamFingerprintsForPage(
    input.page_id,
    input.upstream_output_fingerprints,
  );
  const payload: Record<string, unknown> = {
    graph_version: REPORT_ORCHESTRATION_GRAPH_VERSION,
    page_id: input.page_id,
    output_schema_version: def.output_schema_version,
    prompt_version: def.prompt_version,
    production_version: def.production_version,
    validator_version: input.validator_version ?? def.production_version,
    conditional: def.conditional,
    model_generation: def.model_generation,
    shared: sharedSlice(input.shared),
    upstream_output_fingerprints: upstream,
  };
  if (input.page_id === "07" || input.page_id === "08") {
    payload.page07_applicability_status =
      input.page07_applicability_status ?? null;
  }
  return payload;
}

export function computePageInputFingerprint(
  input: ReportPageFingerprintInput,
): ReportPageFingerprintResult {
  const canonical_payload = buildPageInputFingerprintPayload(input);
  return {
    page_id: input.page_id,
    fingerprint: hashCanonicalPayload(canonical_payload),
    canonical_payload,
  };
}

export function computeAllPageInputFingerprints(input: {
  shared: ReportSharedInputSnapshot;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  page07_applicability_status?:
    | "applicable"
    | "not_applicable"
    | "insufficient_information"
    | null;
  validator_version?: string;
}): Record<ReportPageId, ReportPageFingerprintResult> {
  const out = {} as Record<ReportPageId, ReportPageFingerprintResult>;
  for (const page_id of [
    "01",
    "02",
    "04",
    "05",
    "06",
    "07",
    "08",
  ] as const) {
    out[page_id] = computePageInputFingerprint({
      page_id,
      shared: input.shared,
      upstream_output_fingerprints: input.upstream_output_fingerprints,
      page07_applicability_status: input.page07_applicability_status,
      validator_version: input.validator_version,
    });
  }
  return out;
}
