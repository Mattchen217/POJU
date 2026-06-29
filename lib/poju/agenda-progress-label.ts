import type { POJUAgentState } from "@/lib/poju/agent-state";

/** Lightweight progress copy for collecting UI — no gate numbers exposed. */
export function formatAgendaProgressLabel(
  agent: POJUAgentState | null | undefined,
  locale: string,
): string | null {
  if (!agent || agent.current_phase !== "collecting_context") return null;
  const agenda = agent.investigation_agenda ?? [];
  if (agenda.length === 0) return null;
  const covered = agenda.filter((a) => a.status === "covered" || a.status === "partial").length;
  const isZh = locale.startsWith("zh");
  if (isZh) {
    return `正在从 ${agenda.length} 个角度了解你的处境（已 ${covered}/${agenda.length}）`;
  }
  return `Understanding your situation from ${agenda.length} angles (${covered}/${agenda.length} covered)`;
}
