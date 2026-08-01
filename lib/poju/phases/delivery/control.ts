import {
  applyFinalDeliveryResultToSession,
  FINAL_DELIVERY_JOB_AWAITING,
  runFinalDeliveryForSession,
} from "@/lib/llm/pro/final-delivery";
import { runConfirmationPipeline } from "@/lib/poju/agent-orchestrator";
import {
  createInitialAgentState,
  normalizeAgentPhase,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import { deliveryConfirmButtonLabel, deliverySupplementAck } from "@/lib/poju/delivery-confirm-reply";
import { withSessionProfileFlags } from "@/lib/poju/session-profile";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";

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

/**
 * Phase-3 confirmation gate: user wants to add more before Phase 4.
 * Returns to collecting_context and acknowledges — next user text is absorbed into context.
 */
export function applyDeliveryConfirmationSupplement(
  session: POJUSessionState,
  locale: string,
): POJUSessionState {
  const baseAgent = ensureAgentV2(session);
  const phase = normalizeAgentPhase(baseAgent.current_phase);
  if (phase !== "awaiting_confirmation") return session;

  const signals = extractModelTurnSignals({ confirmation_signal: "wants_to_add" });
  const advance = advanceStateMachine(baseAgent, signals, "");
  const now = new Date().toISOString();
  const ack: POJUMessage = {
    role: "assistant",
    content: deliverySupplementAck(locale),
    timestamp: now,
  };
  return withSessionProfileFlags({
    ...session,
    messages: [...session.messages, ack],
    agent_v2: advance.next_agent,
    last_interaction_at: now,
  });
}

/**
 * Phase-3 confirmation gate: user confirmed — start Phase-4 delivery pipeline.
 * Expects the confirm chip text already appended as the latest user message when
 * `userAlreadyAppended` is true.
 */
export async function startDeliveryAfterGateConfirm(input: {
  session: POJUSessionState;
  locale: string;
  userAlreadyAppended?: boolean;
}): Promise<POJUSessionState> {
  const label = deliveryConfirmButtonLabel(input.locale);
  let session = input.session;
  const baseAgent = ensureAgentV2(session);
  const phase = normalizeAgentPhase(baseAgent.current_phase);
  if (phase !== "awaiting_confirmation") return session;

  if (!input.userAlreadyAppended) {
    const userMsg: POJUMessage = {
      role: "user",
      content: label,
      timestamp: new Date().toISOString(),
    };
    session = { ...session, messages: [...session.messages, userMsg] };
  }

  const signals = extractModelTurnSignals({
    confirmation_signal: "confirmed",
    user_confirms_delivery: true,
  });
  const advance = advanceStateMachine(baseAgent, signals, label);
  if (!advance.trigger_delivery) {
    return withSessionProfileFlags({
      ...session,
      agent_v2: advance.next_agent,
      last_interaction_at: new Date().toISOString(),
    });
  }

  const awaiting = withSessionProfileFlags({
    ...session,
    agent_v2: {
      ...advance.next_agent,
      // Pipeline owns the delivered transition; keep confirmation until result lands.
      current_phase: "awaiting_confirmation",
    },
    last_interaction_at: new Date().toISOString(),
  });

  return runConfirmationPipeline(awaiting, input.locale);
}

/**
 * Strip prior Phase-4 delivery artifacts so regenerate can rewrite the book.
 * Keeps breakthrough_core / agenda / collecting history intact.
 * Marks `__awaiting__` so reopen can resume_latest even before job_id returns.
 */
export function stripDeliveryForRegenerate(session: POJUSessionState): POJUSessionState {
  const messages = session.messages.filter((m) => !m.meta?.contains_delivery);
  return {
    ...session,
    messages,
    main_delivery_done: false,
    main_delivery: null,
    pending_delivery_job_id: FINAL_DELIVERY_JOB_AWAITING,
    actions: session.actions.filter((a) => !a.action_id.startsWith("delivery-")),
  };
}

/** True when a Phase 4 job is still marked in-flight on the session. */
export function isDeliveryJobPending(session: POJUSessionState): boolean {
  return Boolean(session.pending_delivery_job_id?.trim());
}

/**
 * True when Phase 4 can be (re)generated — includes failed first run with no delivery bubble.
 * False while a job id / `__awaiting__` is still on the session (resume owns that path).
 */
export function canStartDeliveryRegenerate(session: POJUSessionState): boolean {
  const agent = session.agent_v2;
  if (!agent) return false;
  if (isDeliveryJobPending(session)) return false;

  const hasCore = Boolean(agent.breakthrough_core);
  const degraded = agent.delivery_mode === "degraded";
  if (!hasCore && !degraded) return false;

  if (session.main_delivery_done) return true;
  if (session.messages.some((m) => m.meta?.contains_delivery)) return true;

  const phase = agent.current_phase;
  if (phase === "delivered" || phase === "tracking") return true;
  // First-run failed after unlock / confirmation — no delivery bubble left to host the button.
  if (phase === "awaiting_confirmation" && (session.unlock_status === "unlocked" || hasCore)) {
    return true;
  }
  if (session.unlock_status === "unlocked" && hasCore) return true;

  return false;
}

/**
 * QA / ops: re-run Phase 4 book without walking stages 1–3 again.
 * Also used as retry after a failed first delivery (no delivery bubble yet).
 */
export async function startDeliveryRegenerate(input: {
  session: POJUSessionState;
  locale: string;
  /** Called after local strip+awaiting is persisted (so UI can reflect leave-safe state). */
  onAwaitingPersisted?: (session: POJUSessionState) => void;
}): Promise<POJUSessionState> {
  if (!canStartDeliveryRegenerate(input.session)) {
    throw new Error("session not ready for delivery regenerate");
  }
  const cleaned = stripDeliveryForRegenerate(input.session);
  if (!cleaned.agent_v2?.breakthrough_core && cleaned.agent_v2?.delivery_mode !== "degraded") {
    throw new Error("breakthrough_core required to regenerate full delivery");
  }
  const { savePOJUSession } = await import("@/lib/poju/session-manager");
  await savePOJUSession(cleaned);
  input.onAwaitingPersisted?.(cleaned);

  return runFinalDeliveryForSession(cleaned, input.locale, {
    delivery_mode: cleaned.agent_v2?.delivery_mode ?? "full",
    regenerate: true,
  });
}

export { applyFinalDeliveryResultToSession };
