/**
 * Page output provenance — validity is not just outcome=completed.
 */

import type { ReportPageId, ReportUpstreamOutputFingerprints } from "../orchestration/types";
import { casSet, kvGet, isBatch3SharedStoreAvailable, kvUnavailable } from "./kv-cas";
import type { Batch3Result, PageProvenance } from "./types";

function provKey(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:prov:${page_id}`;
}

export async function writePageProvenance(
  provenance: PageProvenance,
): Promise<Batch3Result<void>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const key = provKey(
    provenance.report_id,
    provenance.generation_id,
    provenance.page_id,
  );
  const cur = await kvGet<PageProvenance>(key);
  if (!cur.ok) return cur;
  return casSet(key, cur.value == null ? null : JSON.stringify(cur.value), provenance);
}

export async function readPageProvenance(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): Promise<Batch3Result<PageProvenance | null>> {
  return kvGet<PageProvenance>(provKey(report_id, generation_id, page_id));
}

export function isProvenanceStale(input: {
  provenance: PageProvenance;
  generation_epoch: number;
  generation_id: string;
  current_input_fingerprint: string;
  current_upstream: ReportUpstreamOutputFingerprints;
  page_contract_version: string;
  prompt_version: string;
  validator_version: string;
}): { stale: boolean; reason?: string } {
  const p = input.provenance;
  if (p.stale) return { stale: true, reason: p.stale_reason ?? "marked_stale" };
  if (p.generation_id !== input.generation_id) {
    return { stale: true, reason: "generation_id_mismatch" };
  }
  if (p.generation_epoch !== input.generation_epoch) {
    return { stale: true, reason: "generation_epoch_mismatch" };
  }
  if (p.input_fingerprint !== input.current_input_fingerprint) {
    return { stale: true, reason: "input_fingerprint_changed" };
  }
  if (p.page_contract_version !== input.page_contract_version) {
    return { stale: true, reason: "page_contract_version_changed" };
  }
  if (p.prompt_version !== input.prompt_version) {
    return { stale: true, reason: "prompt_version_changed" };
  }
  if (p.validator_version !== input.validator_version) {
    return { stale: true, reason: "validator_version_changed" };
  }
  for (const [up, fp] of Object.entries(p.upstream_output_fingerprints ?? {})) {
    const cur = input.current_upstream[up as ReportPageId];
    if (!cur || cur !== fp) {
      return { stale: true, reason: `upstream_${up}_fingerprint_changed` };
    }
  }
  return { stale: false };
}

export async function markProvenanceStale(input: {
  report_id: string;
  generation_id: string;
  page_id: ReportPageId;
  reason: string;
}): Promise<Batch3Result<PageProvenance | null>> {
  const cur = await readPageProvenance(
    input.report_id,
    input.generation_id,
    input.page_id,
  );
  if (!cur.ok) return cur;
  if (!cur.value) return { ok: true, value: null };
  const next: PageProvenance = {
    ...cur.value,
    stale: true,
    stale_reason: input.reason,
  };
  const saved = await casSet(
    provKey(input.report_id, input.generation_id, input.page_id),
    JSON.stringify(cur.value),
    next,
  );
  if (!saved.ok) return saved;
  return { ok: true, value: next };
}
