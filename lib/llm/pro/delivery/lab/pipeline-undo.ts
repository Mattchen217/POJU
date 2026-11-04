/**
 * LAB full_pipeline · undo last step (ops rewind).
 * Drops the latest logical step + its chat bubbles; parks at the prior cursor.
 * Does NOT re-enqueue jobs (unlike 重跑).
 */

import {
  createInitialAgentState,
  normalizeAgentPhase,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import { ensureSessionCycles } from "@/lib/poju/cycle-manager";
import { withSessionProfileFlags } from "@/lib/poju/session-profile";
import { resolvePivotSessionLang } from "@/lib/poju/session-lang";
import { understandingGateConfirmButtonLabel } from "@/lib/poju/understanding-gate-reply";
import { deliveryConfirmButtonLabel } from "@/lib/poju/delivery-confirm-reply";
import {
  clearPendingSegment2Job,
} from "@/lib/poju/phases/segment2/control";
import { derivePipelineCursor } from "@/lib/llm/pro/delivery/lab/pipeline-cursor";
import type { LabPipelineTurn } from "@/lib/llm/pro/delivery/lab/lab-pipeline-types";
import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import type { POJUSessionState } from "@/lib/poju/types";

function ensureAgentV2(session: POJUSessionState): POJUAgentState {
  const base = session.agent_v2;
  if (base) {
    const phase = normalizeAgentPhase(base.current_phase) ?? base.current_phase;
    return { ...base, current_phase: phase };
  }
  return createInitialAgentState({
    original_question: session.original_question,
    selected_profile_id: session.selected_stored_profile_id,
  });
}

export type LabUndoTarget =
  | { kind: "chat"; label: string }
  | { kind: "segment2_a"; label: string }
  | { kind: "segment2_b"; label: string }
  | { kind: "synthesis"; label: string }
  | { kind: "pending"; stage: string; label: string }
  | { kind: "gate"; action: string; label: string };

/** What「撤销」will remove — for button label / disabled state. */
export function labUndoTarget(lab: DeliveryLabSession): LabUndoTarget | null {
  if (lab.mode !== "full_pipeline" || !lab.chat_session) return null;
  const pending = lab.pipeline_pending_job;
  if (pending) {
    const stage = pending.stage;
    const label =
      stage === "segment2_a"
        ? "进行中的 Call A"
        : stage === "segment2_b"
          ? "进行中的 Call B"
          : stage === "synthesis"
            ? "进行中的 Synthesis"
            : `进行中的 ${stage}`;
    return { kind: "pending", stage, label };
  }
  const turns = lab.pipeline_turns ?? [];
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (!t) continue;
    if (t.kind === "chat") return { kind: "chat", label: "对话" };
    if (t.kind === "segment2_b") return { kind: "segment2_b", label: "Call B · 议程+首问" };
    if (t.kind === "segment2_a") return { kind: "segment2_a", label: "Call A · 分析" };
    if (t.kind === "synthesis") return { kind: "synthesis", label: "Synthesis" };
    if (t.kind === "gate") {
      const action = t.gate?.action ?? "gate";
      return { kind: "gate", action, label: `闸门 · ${action}` };
    }
  }
  return null;
}

function findPrecedingGate(
  turns: LabPipelineTurn[],
  fromIdx: number,
  action: string,
): number {
  if (fromIdx <= 0) return fromIdx;
  const prev = turns[fromIdx - 1];
  if (prev?.kind === "gate" && prev.gate?.action === action) return fromIdx - 1;
  return fromIdx;
}

function findLastGateAction(turns: LabPipelineTurn[], action: string): number {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i]?.kind === "gate" && turns[i]!.gate?.action === action) return i;
  }
  return -1;
}

function popTrailingUserIf(session: POJUSessionState, label: string): POJUSessionState {
  const msgs = [...session.messages];
  const last = msgs[msgs.length - 1];
  if (last?.role === "user" && last.content.trim() === label.trim()) {
    msgs.pop();
    return { ...session, messages: msgs };
  }
  return session;
}

function restoreUnderstandingConfirm(session: POJUSessionState, locale: string): POJUSessionState {
  const base = ensureAgentV2(session);
  const confirmLabel = understandingGateConfirmButtonLabel(locale);
  let messages = session.messages.filter(
    (m) =>
      !(
        m.role === "assistant" &&
        (m.meta?.segment2_analysis ||
          m.meta?.segment2_bridge_question ||
          m.meta?.segment2_agenda_bridge_failed ||
          m.meta?.core_generation_failed)
      ),
  );
  const trimmed = { ...session, messages };
  const withoutConfirm = popTrailingUserIf(trimmed, confirmLabel);
  return clearPendingSegment2Job(
    withSessionProfileFlags({
      ...withoutConfirm,
      pending_synthesis_job_id: null,
      agent_v2: {
        ...base,
        current_phase: "awaiting_understanding_confirm",
        breakthrough_core: null,
        investigation_agenda: [],
        agenda_generated: false,
        has_situation_analysis: false,
        core_generation_failed: false,
        synthesis_status: undefined,
        synthesis_generation_failed: false,
      },
      last_interaction_at: new Date().toISOString(),
    }),
  );
}

function restoreAfterCallBRemoved(session: POJUSessionState): POJUSessionState {
  const base = ensureAgentV2(session);
  const core = base.breakthrough_core;
  const messages = session.messages.filter(
    (m) =>
      !(
        m.role === "assistant" &&
        (m.meta?.segment2_bridge_question || m.meta?.segment2_agenda_bridge_failed)
      ),
  );
  return clearPendingSegment2Job(
    withSessionProfileFlags({
      ...session,
      messages,
      agent_v2: {
        ...base,
        breakthrough_core: core
          ? { ...core, first_question: undefined }
          : null,
        investigation_agenda: [],
        agenda_generated: false,
        current_phase: "collecting_context",
        core_generation_failed: false,
      },
      last_interaction_at: new Date().toISOString(),
    }),
  );
}

function restoreAwaitingConfirmation(session: POJUSessionState, locale: string): POJUSessionState {
  const base = ensureAgentV2(session);
  const confirmLabel = deliveryConfirmButtonLabel(locale);
  const withoutConfirm = popTrailingUserIf(session, confirmLabel);
  return withSessionProfileFlags({
    ...withoutConfirm,
    pending_synthesis_job_id: null,
    agent_v2: {
      ...base,
      current_phase: "awaiting_confirmation",
      synthesis_status: undefined,
      synthesis_generation_failed: false,
    },
    last_interaction_at: new Date().toISOString(),
  });
}

function finish(lab: DeliveryLabSession, session: POJUSessionState, turns: LabPipelineTurn[]): DeliveryLabSession {
  const out: DeliveryLabSession = {
    ...lab,
    chat_session: ensureSessionCycles(session),
    pipeline_turns: turns,
    pipeline_pending_job: null,
    pipeline_delivery_unlocked: false,
  };
  // Keep source breakthrough only while Call A result still on session.
  const core = ensureAgentV2(session).breakthrough_core;
  out.source = {
    ...lab.source,
    breakthrough_core: core ?? undefined,
    original_question:
      session.original_question?.trim() || lab.source.original_question,
  };
  out.pipeline_cursor = derivePipelineCursor(out);
  return out;
}

function undoPending(lab: DeliveryLabSession, turns: LabPipelineTurn[]): DeliveryLabSession {
  const pending = lab.pipeline_pending_job!;
  const locale = resolvePivotSessionLang(lab.chat_session!, lab.source.locale || "zh");
  let session = lab.chat_session!;

  if (pending.stage === "segment2_a") {
    const gateIdx = findLastGateAction(turns, "understanding_confirm");
    const cut = gateIdx >= 0 ? gateIdx : turns.length;
    session = restoreUnderstandingConfirm(session, locale);
    return finish(lab, session, turns.slice(0, cut));
  }
  if (pending.stage === "segment2_b") {
    const gateIdx = findLastGateAction(turns, "agenda_confirm");
    const cut = gateIdx >= 0 ? gateIdx : turns.length;
    // Call A already applied — just cancel Call B kick.
    session = clearPendingSegment2Job({
      ...session,
      agent_v2: {
        ...ensureAgentV2(session),
        agenda_generated: false,
        investigation_agenda: [],
        current_phase: "collecting_context",
      },
    });
    return finish(lab, session, turns.slice(0, cut));
  }
  if (pending.stage === "synthesis") {
    const gateIdx = findLastGateAction(turns, "synthesis_confirm");
    const cut = gateIdx >= 0 ? gateIdx : turns.length;
    session = restoreAwaitingConfirmation(session, locale);
    return finish(lab, session, turns.slice(0, cut));
  }
  throw new Error(`cannot_undo_pending_${pending.stage}`);
}

function undoChat(
  lab: DeliveryLabSession,
  turns: LabPipelineTurn[],
  lastIdx: number,
): DeliveryLabSession {
  const lastTurn = turns[lastIdx]!;
  const userInput = lastTurn.user_input?.trim() ?? "";
  let messages = [...lab.chat_session!.messages];

  if (messages[messages.length - 1]?.role === "assistant") {
    messages = messages.slice(0, -1);
  }
  if (
    userInput &&
    messages[messages.length - 1]?.role === "user" &&
    messages[messages.length - 1]!.content.trim() === userInput
  ) {
    messages = messages.slice(0, -1);
  }

  let session: POJUSessionState = {
    ...lab.chat_session!,
    messages,
  };

  // If we removed a post-gate revise and the previous assistant is still the
  // understanding card, park back on the confirm gate.
  const lastAsst = [...messages].reverse().find((m) => m.role === "assistant");
  if (lastAsst?.meta?.understanding_gate_pending) {
    session = {
      ...session,
      agent_v2: {
        ...ensureAgentV2(session),
        current_phase: "awaiting_understanding_confirm",
        active_question_state: null,
      },
    };
  } else if (lastAsst?.meta?.segment2_analysis) {
    // Undid a collecting reply after Call A — stay collecting without agenda if needed.
    const base = ensureAgentV2(session);
    if (!base.agenda_generated) {
      session = {
        ...session,
        agent_v2: { ...base, current_phase: "collecting_context" },
      };
    }
  } else {
    // Default: keep phase, but if phase was collecting without core, opening is safer.
    const phase =
      normalizeAgentPhase(session.agent_v2?.current_phase) ?? session.agent_v2?.current_phase;
    if (phase === "collecting_context" && !session.agent_v2?.breakthrough_core) {
      session = {
        ...session,
        agent_v2: {
          ...ensureAgentV2(session),
          current_phase: lastAsst?.meta?.understanding_gate_pending
            ? "awaiting_understanding_confirm"
            : "opening",
        },
      };
    }
  }

  return finish(lab, session, turns.slice(0, lastIdx));
}

function undoSegment2B(
  lab: DeliveryLabSession,
  turns: LabPipelineTurn[],
  lastIdx: number,
): DeliveryLabSession {
  const cut = findPrecedingGate(turns, lastIdx, "agenda_confirm");
  const session = restoreAfterCallBRemoved(lab.chat_session!);
  return finish(lab, session, turns.slice(0, cut));
}

function undoSegment2A(
  lab: DeliveryLabSession,
  turns: LabPipelineTurn[],
  lastIdx: number,
): DeliveryLabSession {
  // Also drop any Call B / later chat after Call A (depended on analysis).
  let end = lastIdx;
  for (let i = lastIdx + 1; i < turns.length; i++) {
    end = i;
  }
  const cut = findPrecedingGate(turns, lastIdx, "understanding_confirm");
  // If there were turns after A, cut from understanding_confirm through end.
  const locale = resolvePivotSessionLang(lab.chat_session!, lab.source.locale || "zh");
  let session = restoreUnderstandingConfirm(lab.chat_session!, locale);
  // If Call B messages existed, restoreUnderstandingConfirm already stripped them.
  void end;
  return finish(lab, session, turns.slice(0, cut));
}

function undoSynthesis(
  lab: DeliveryLabSession,
  turns: LabPipelineTurn[],
  lastIdx: number,
): DeliveryLabSession {
  const cut = findPrecedingGate(turns, lastIdx, "synthesis_confirm");
  const locale = resolvePivotSessionLang(lab.chat_session!, lab.source.locale || "zh");
  const session = restoreAwaitingConfirmation(lab.chat_session!, locale);
  return finish(lab, session, turns.slice(0, cut));
}

function undoLoneGate(
  lab: DeliveryLabSession,
  turns: LabPipelineTurn[],
  lastIdx: number,
): DeliveryLabSession {
  const action = turns[lastIdx]?.gate?.action ?? "";
  const locale = resolvePivotSessionLang(lab.chat_session!, lab.source.locale || "zh");

  if (action === "understanding_confirm") {
    return finish(
      lab,
      restoreUnderstandingConfirm(lab.chat_session!, locale),
      turns.slice(0, lastIdx),
    );
  }
  if (action === "agenda_confirm") {
    return finish(
      lab,
      restoreAfterCallBRemoved(lab.chat_session!),
      turns.slice(0, lastIdx),
    );
  }
  if (action === "synthesis_confirm") {
    return finish(
      lab,
      restoreAwaitingConfirmation(lab.chat_session!, locale),
      turns.slice(0, lastIdx),
    );
  }
  // dyad_skip / dyad_collect / other — drop gate turn only; leave path locks
  // (rewinding dyad path needs a dedicated flow). Still remove the turn record.
  return finish(lab, lab.chat_session!, turns.slice(0, lastIdx));
}

/**
 * Undo the latest LAB pipeline step. Parks at the previous cursor so ops can
 * re-confirm / re-type / click Next — does not auto-rerun.
 */
export function labUndoLastStep(lab: DeliveryLabSession): DeliveryLabSession {
  if (lab.mode !== "full_pipeline" || !lab.chat_session) {
    throw new Error("lab_not_full_pipeline");
  }
  const turns = [...(lab.pipeline_turns ?? [])];
  if (lab.pipeline_pending_job) {
    return undoPending(lab, turns);
  }
  if (turns.length === 0) throw new Error("nothing_to_undo");

  let lastNonGate = -1;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i]?.kind && turns[i]!.kind !== "gate") {
      lastNonGate = i;
      break;
    }
  }

  if (lastNonGate >= 0) {
    const kind = turns[lastNonGate]!.kind;
    if (kind === "chat") return undoChat(lab, turns, lastNonGate);
    if (kind === "segment2_b") return undoSegment2B(lab, turns, lastNonGate);
    if (kind === "segment2_a") return undoSegment2A(lab, turns, lastNonGate);
    if (kind === "synthesis") return undoSynthesis(lab, turns, lastNonGate);
  }

  // Only gate turns left (or trailing gate after undos).
  return undoLoneGate(lab, turns, turns.length - 1);
}
