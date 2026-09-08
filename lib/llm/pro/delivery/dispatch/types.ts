/**
 * Phase-4 dispatch DAG — one atomic LLM (or merge) unit per independent worker invoke.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
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

/** Max concurrent in-flight worker publishes per scheduler tick. */
export const DELIVERY_DISPATCH_MAX_INFLIGHT = 8;

/** Stagger between QStash publishes (ms). */
export const DELIVERY_DISPATCH_STAGGER_MS = 2_500;

/** Write units per chunk task (matches deep-evidence WRITE_CHUNK_SIZE). */
export const DELIVERY_DISPATCH_WRITE_CHUNK_SIZE = 2;
