import type { POJUAgentState } from "@/lib/poju/agent-state";
import { agentPhaseToPojuState } from "@/lib/poju/state-machine";
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
    problem_understood:
      agentPhaseToPojuState(agent.current_phase) !== "opening" &&
      Boolean(agent.original_question?.trim()),
    relationship_conclusion: Boolean(agent.breakthrough_core?.situation_conclusion),
    breakthrough_direction: (agent.breakthrough_core?.modern_action_frames?.length ?? 0) > 0,
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

  const prevMeta = msgs[idx].meta;
  const prevSnap = prevMeta?.state_snapshot;
  const snapshotUnchanged =
    prevSnap != null &&
    prevSnap.phase === snapshot.phase &&
    prevSnap.problem_understood === snapshot.problem_understood &&
    prevSnap.relationship_conclusion === snapshot.relationship_conclusion &&
    prevSnap.breakthrough_direction === snapshot.breakthrough_direction &&
    prevSnap.agenda_built === snapshot.agenda_built &&
    prevSnap.agenda_progress === snapshot.agenda_progress &&
    prevSnap.delivered === snapshot.delivered;

  if (snapshotUnchanged && !agendaJustBuilt) {
    return session;
  }

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
