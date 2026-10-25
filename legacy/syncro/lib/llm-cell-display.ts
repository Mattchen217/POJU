import type { SyncroCombination, SyncroSession } from "@/lib/syncro/types";

export type SyncroCellDisplayState = "loading" | "ready" | "failed";

/** True when this cell has real LLM copy (not local placeholder / legacy fallback). */
export function isSyncroLlmReady(
  cell: SyncroCombination | undefined,
  llmMeta?: SyncroSession["llm_meta"],
): boolean {
  return getSyncroCellDisplayState(cell, llmMeta) === "ready";
}

export function getSyncroCellDisplayState(
  cell: SyncroCombination | undefined,
  _llmMeta?: SyncroSession["llm_meta"],
): SyncroCellDisplayState {
  if (!cell) return "loading";
  if (cell.llm_failed) return "failed";

  const hasCopy =
    Boolean(cell.short_advice?.trim()) ||
    Boolean(cell.detailed_advice?.trim()) ||
    Boolean(cell.rationale?.trim());

  if (cell.llm_pending) return "loading";
  if (!hasCopy) return "loading";
  return "ready";
}
