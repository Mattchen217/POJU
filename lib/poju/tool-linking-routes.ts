import type { ToolName, ToolSuggestionPayload } from "@/lib/poju/types";

export function flattenToolPrefill(prefill?: Record<string, unknown>): Record<string, string> {
  if (!prefill) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(prefill)) {
    if (typeof value === "string") result[key] = value;
    else if (typeof value === "boolean") result[key] = String(value);
    else if (typeof value === "number") result[key] = String(value);
  }
  return result;
}

/** Product entry path + query for POJU → tool handoff (Step 3). */
export function buildToolHandoffPath(
  tool: ToolName,
  input: {
    sessionId: string;
    cycleId: string;
    prefill?: ToolSuggestionPayload["prefill"];
  },
): string {
  const params = new URLSearchParams({
    from_poju_session: input.sessionId,
    from_poju_cycle: input.cycleId,
    ...flattenToolPrefill(input.prefill),
  });

  switch (tool) {
    case "glyph":
      return `/glyph/prepare?${params.toString()}`;
    case "syncro":
      return `/syncro/prepare?${params.toString()}`;
    case "match":
      return `/match?${params.toString()}`;
  }
}
