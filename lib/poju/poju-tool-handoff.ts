import type { ToolName } from "@/lib/poju/types";

export const POJU_TOOL_HANDOFF_STORAGE_KEY = "pojulife_poju_tool_handoff_v1";

export type PojuToolHandoff = {
  session_id: string;
  cycle_id: string;
  tool: ToolName;
  quota_free: boolean;
  prefill: Record<string, string>;
  captured_at: string;
};

const PREFILL_PARAM_KEYS = [
  "task_description",
  "event_time",
  "partner_relationship",
  "implicit_question",
  "needs_partner_info",
] as const;

export function flattenSearchPrefill(searchParams: {
  get: (key: string) => string | null;
  entries?: () => IterableIterator<[string, string]>;
}): Record<string, string> {
  const skip = new Set(["from_poju_session", "from_poju_cycle"]);
  const out: Record<string, string> = {};

  if (typeof searchParams.entries === "function") {
    for (const [key, value] of searchParams.entries()) {
      if (skip.has(key) || !value) continue;
      out[key] = value;
    }
    return out;
  }

  for (const key of PREFILL_PARAM_KEYS) {
    const value = searchParams.get(key);
    if (value) out[key] = value;
  }
  return out;
}

/** Read URL params when landing from POJU tool card (before sessionStorage persist). */
export function readPojuHandoffFromSearchParams(
  searchParams: { get: (key: string) => string | null },
  tool: ToolName,
): Omit<PojuToolHandoff, "quota_free" | "captured_at"> | null {
  const session_id = searchParams.get("from_poju_session")?.trim();
  const cycle_id = searchParams.get("from_poju_cycle")?.trim();
  if (!session_id || !cycle_id) return null;
  return {
    session_id,
    cycle_id,
    tool,
    prefill: flattenSearchPrefill(searchParams),
  };
}

export function savePojuToolHandoff(handoff: PojuToolHandoff): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(POJU_TOOL_HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
}

export function loadPojuToolHandoff(expectedTool?: ToolName): PojuToolHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(POJU_TOOL_HANDOFF_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PojuToolHandoff;
    if (!parsed?.session_id || !parsed?.cycle_id || !parsed?.tool) return null;
    if (expectedTool && parsed.tool !== expectedTool) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPojuToolHandoff(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(POJU_TOOL_HANDOFF_STORAGE_KEY);
}
