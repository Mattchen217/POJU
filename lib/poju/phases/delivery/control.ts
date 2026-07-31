import {
  applyFinalDeliveryResultToSession,
  FINAL_DELIVERY_JOB_AWAITING,
  runFinalDeliveryForSession,
} from "@/lib/llm/pro/final-delivery";
import type { POJUSessionState } from "@/lib/poju/types";

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
