import type { HourPeriod } from "@/lib/syncro/types";

/** Client-side Syncro LLM batch progress (result page + preparing). */
export type SyncroLlmProgress = {
  completed: number;
  total: number;
  running: boolean;
  failed: number;
  failed_hours?: HourPeriod[];
  current_hour?: HourPeriod;
  context_missing?: boolean;
  kv_unavailable?: boolean;
  priority_generating?: boolean;
};
