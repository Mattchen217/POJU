"use client";

/**
 * Step 5.4 — client-side LLM batch pipeline after `compute_local`.
 * Mounted from `/syncro/result/[id]`; runs 6 parallel `/api/syncro/llm_batch` calls.
 */
export {
  SyncroLlmBatchRunner as SyncroResultLoader,
  type SyncroLlmProgress,
} from "@/components/syncro/SyncroLlmBatchRunner";
