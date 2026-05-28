import { loadPOJUSession } from "@/lib/poju/session-manager";
import { checkToolQuota } from "@/lib/poju/cycle-manager";
import type { ToolName } from "@/lib/poju/types";

/**
 * Whether this POJU session/cycle still has a free tool recommendation slot for `tool`.
 */
export async function checkPojuQuota(
  tool: ToolName,
  session_id: string,
  cycle_id: string,
): Promise<boolean> {
  try {
    const session = await loadPOJUSession(session_id);
    if (!session) return false;
    if (session.active_cycle_id !== cycle_id) return false;
    return checkToolQuota(session, tool).available;
  } catch (e) {
    console.error("[check-poju-quota]", e);
    return false;
  }
}
