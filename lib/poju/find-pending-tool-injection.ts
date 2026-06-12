import { getActiveCycle } from "@/lib/poju/cycle-manager";
import type { POJUSessionState, ToolName } from "@/lib/poju/types";

export type PendingToolInjection = {
  tool: ToolName;
  tool_result_id: string;
  tool_result_data: unknown;
  delivery_handoff?: boolean;
};

export function findPendingToolInjection(state: POJUSessionState): PendingToolInjection | null {
  const cycle = getActiveCycle(state);
  if (!cycle) return null;

  const row = cycle.tool_suggestions.find(
    (s) =>
      s.tool_result_data != null &&
      s.tool_result_id &&
      s.injected_to_poju !== true &&
      s.user_action === "accepted",
  );

  if (!row?.tool_result_id) return null;

  return {
    tool: row.tool,
    tool_result_id: row.tool_result_id,
    tool_result_data: row.tool_result_data,
    delivery_handoff: row.suggested_in_message_id === "external-from-tool",
  };
}
