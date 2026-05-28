import { injectToolResult } from "@/lib/poju/cycle-manager";
import { extractToolSummary } from "@/lib/poju/extract-tool-summary";
import { loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import type { ToolName } from "@/lib/poju/types";

export { extractToolSummary } from "@/lib/poju/extract-tool-summary";

export async function injectToolResultToPoju(input: {
  session_id: string;
  tool: ToolName;
  result_id: string;
  result_data: unknown;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const state = await loadPOJUSession(input.session_id);
    if (!state) return false;
    const summary = extractToolSummary(input.tool, input.result_data);
    const next = injectToolResult(state, input.tool, input.result_id, summary);
    await savePOJUSession(next);
    return true;
  } catch (e) {
    console.error("[inject-tool-result]", e);
    return false;
  }
}
