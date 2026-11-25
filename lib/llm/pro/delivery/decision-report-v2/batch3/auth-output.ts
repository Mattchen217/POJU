/**
 * Canonical page output stored with authority commit — Recovery can replay
 * Batch2 page blobs without re-invoking the model.
 */

import type { ReportPageId, ReportPageRuntimeState } from "../orchestration/types";
import {
  casSet,
  isBatch3SharedStoreAvailable,
  kvGet,
  kvUnavailable,
  trackBatch3Key,
} from "./kv-cas";
import type { Batch3Result } from "./types";

export type AuthorityPageOutput = {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  validity_rev: number;
  attempt_id: string;
  task_key: string;
  output_fingerprint: string;
  output: unknown;
  state_patch: Partial<ReportPageRuntimeState>;
  completed_at: string;
};

export function authOutputKey(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:auth-output:${page_id}`;
}

export async function writeAuthorityPageOutput(
  record: AuthorityPageOutput,
): Promise<Batch3Result<void>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const key = authOutputKey(record.report_id, record.generation_id, record.page_id);
  trackBatch3Key(key);
  const cur = await kvGet<AuthorityPageOutput>(key);
  if (!cur.ok) return cur;
  return casSet(key, cur.value == null ? null : JSON.stringify(cur.value), record);
}

export async function readAuthorityPageOutput(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): Promise<Batch3Result<AuthorityPageOutput | null>> {
  return kvGet<AuthorityPageOutput>(authOutputKey(report_id, generation_id, page_id));
}
