import type { ToolName } from "@/lib/poju/types";

const PENDING_KEY = "pojulife_from_tool_pending";
const STASH_PREFIX = "pojulife_tool_result_stash_";

export type FromToolPending = {
  tool: ToolName;
  result_id: string;
  result_data: Record<string, unknown>;
  suggested_question: string;
};

export function stashToolResultForHandoff(
  tool: ToolName,
  resultId: string,
  data: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${STASH_PREFIX}${tool}_${resultId}`, JSON.stringify(data));
  } catch {
    // ignore quota
  }
}

export function readStashedToolResult(tool: ToolName, resultId: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${STASH_PREFIX}${tool}_${resultId}`);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function setFromToolPending(pending: FromToolPending): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function readFromToolPending(): FromToolPending | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FromToolPending;
  } catch {
    return null;
  }
}

export function clearFromToolPending(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_KEY);
}
