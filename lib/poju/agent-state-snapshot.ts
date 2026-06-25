import type { POJUAgentState } from "@/lib/poju/agent-state";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";

export interface PojuStateSnapshot {
  phase: string;
  problem_understood: boolean;
  relationship_conclusion: boolean;
  breakthrough_direction: boolean;
  agenda_built: boolean;
  agenda_progress: string;
  delivered: boolean;
}

export function buildAgentStateSnapshot(
  agent: POJUAgentState,
  delivered = false,
): PojuStateSnapshot {
  const agenda = agent.investigation_agenda ?? [];
  const covered = agenda.filter((a) => a.status === "covered").length;
  return {
    phase: agent.current_phase,
    problem_understood: agent.current_phase !== "opening" || Boolean(agent.has_base_analysis),
    relationship_conclusion: Boolean(agent.breakthrough_core?.relationship_conclusion),
    breakthrough_direction: (agent.breakthrough_core?.breakthrough_directions?.length ?? 0) > 0,
    agenda_built: agenda.length > 0,
    agenda_progress: `${covered}/${agenda.length}`,
    delivered: Boolean(delivered || agent.main_delivery_at),
  };
}

export function patchLastAssistantOrchestrationMeta(
  session: import("@/lib/poju/types").POJUSessionState,
  before: import("@/lib/poju/types").POJUSessionState,
): import("@/lib/poju/types").POJUSessionState {
  const agent = session.agent_v2;
  if (!agent) return session;

  const msgs = [...session.messages];
  let idx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "assistant" && !msgs[i].is_rejected) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return session;

  const hadAgenda = (before.agent_v2?.investigation_agenda?.length ?? 0) > 0;
  const hasAgenda = (agent.investigation_agenda?.length ?? 0) > 0;
  const agendaJustBuilt = !hadAgenda && hasAgenda;
  const snapshot = buildAgentStateSnapshot(agent, session.main_delivery_done);

  msgs[idx] = {
    ...msgs[idx],
    meta: {
      ...msgs[idx].meta,
      state_snapshot: snapshot,
      ...(agendaJustBuilt ? { investigation_agenda: agent.investigation_agenda as AgendaItem[] } : {}),
    },
  };

  return { ...session, messages: msgs };
}

export function syncSessionOriginalQuestion(
  session: import("@/lib/poju/types").POJUSessionState,
): import("@/lib/poju/types").POJUSessionState {
  const fromAgent = session.agent_v2?.original_question?.trim();
  if (!fromAgent || fromAgent === session.original_question) return session;
  return { ...session, original_question: fromAgent };
}
