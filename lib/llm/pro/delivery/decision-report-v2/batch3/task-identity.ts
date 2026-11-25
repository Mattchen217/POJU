/**
 * Deterministic task idempotency keys (SHA-256 of stable canonical payload).
 */

import { createHash } from "node:crypto";

import type { ReportPageId, ReportUpstreamOutputFingerprints } from "../orchestration/types";
import type { TaskType } from "./types";

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeysDeep(obj[key]);
    }
    return out;
  }
  return value;
}

export function computeTaskKey(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  /** Required: invalidation creates a new Task identity even with same inputs. */
  validity_rev: number;
  input_fingerprint: string;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  page_contract_version: string;
  prompt_version: string;
  validator_version: string;
  task_type: TaskType;
}): string {
  const payload = sortKeysDeep({
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    validity_rev: input.validity_rev,
    input_fingerprint: input.input_fingerprint.trim(),
    upstream_output_fingerprints: input.upstream_output_fingerprints ?? {},
    page_contract_version: input.page_contract_version,
    prompt_version: input.prompt_version,
    validator_version: input.validator_version,
    task_type: input.task_type,
  });
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
