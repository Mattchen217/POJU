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

/**
 * QA / ops: re-run Phase 4 book without walking stages 1–3 again.
 * Uses async xhigh job — result is KV-persisted; closing the tab does not lose the book.
 */
export async function startDeliveryRegenerate(input: {
  session: POJUSessionState;
  locale: string;
  /** Called after local strip+awaiting is persisted (so UI can reflect leave-safe state). */
  onAwaitingPersisted?: (session: POJUSessionState) => void;
}): Promise<POJUSessionState> {
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
