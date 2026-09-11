/**
 * Phase-4 dispatch DAG — one atomic LLM (or merge) unit per independent worker invoke.
 */

import type { DeliveryArgumentTree, DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidenceAssignment } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import type { DeepEvidencePlan, DeepEvidenceUnit } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";

export type DeliveryDispatchTaskStatus =
  | "pending"
  | "locked"
  | "running"
  | "ok"
  | "failed";

export type DeliveryDispatchTaskKind =
  | "p1_fill"
  | "assign"
  | "write_chunk"
  | "write_merge"
  | "fill"
  | "mark"
  | "mark_chunk"
  | "mark_merge"
  | "ready"
  | "wave_b_gate"
  | "assemble";

export type DeliveryDispatchTask = {
  id: string;
  kind: DeliveryDispatchTaskKind;
  /** Page key when applicable. */
  key?: DeliverySegmentKey;
  /** 0-based write chunk index. */
  chunk_index?: number;
  deps: string[];
  status: DeliveryDispatchTaskStatus;
  /** App-level attempts (max 2). */
  attempts: number;
  error?: string;
  /** Opaque result payload (assignment / units / page_schema / …). */
  result?: DeliveryDispatchTaskResult;
  updated_at: number;
};

export type DeliveryDispatchTaskResult =
  | { type: "assignment"; assignment: DeepEvidenceAssignment }
  | { type: "write_units"; units: DeepEvidenceUnit[]; chunk_index: number }
  | { type: "plan"; plan: DeepEvidencePlan }
  | { type: "page_schema"; page_schema: DeliveryPageData }
  | {
      type: "mark_partial";
      /** Connective-stage args for this chunk only (pre-encode). */
      partial: DeliveryArgumentTree;
      chunk_index: number;
    }
  | { type: "ready"; key: DeliverySegmentKey }
  | { type: "gate"; unlocked: DeliverySegmentKey[] }
  | { type: "assembled"; full_text_len: number }
  | { type: "empty" };

export type DeliveryDispatchDag = {
  job_id: string;
  version: 1;
  created_at: number;
  updated_at: number;
  tasks: Record<string, DeliveryDispatchTask>;
};

/**
 * Max concurrent in-flight workers for **one job**.
 * This is a safety ceiling for one DAG fan-out (not a product throttle).
 * Wave A may expand to many write chunks at once — a low cap (e.g. 8) defeats
 * dispatch: work waits in line instead of being divided across workers.
 * Each worker is one OpenRouter call; provider multi-tenant load is orthogonal.
 */
export const DELIVERY_DISPATCH_MAX_INFLIGHT = 32;

/** Stagger between QStash publishes (ms) — soft spacing only, not a queue. */
export const DELIVERY_DISPATCH_STAGGER_MS = 1_000;

/**
 * Write units per chunk task.
 * Was 2 — science/metaphysics xhigh write of 2 mechanism blocks routinely burned
 * the full 270s client abort (`write_chunk:llm_timeout`). One unit per invoke
 * keeps each worker under the wall; DAG already fans out one task per chunk.
 */
export const DELIVERY_DISPATCH_WRITE_CHUNK_SIZE = 1;
