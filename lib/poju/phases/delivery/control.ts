import { runFinalDeliveryForSession } from "@/lib/llm/pro/final-delivery";
import type { POJUSessionState } from "@/lib/poju/types";

/**
 * Strip prior Phase-4 delivery artifacts so regenerate can rewrite the book.
 * Keeps breakthrough_core / agenda / collecting history intact.
 */
export function stripDeliveryForRegenerate(session: POJUSessionState): POJUSessionState {
  const messages = session.messages.filter((m) => !m.meta?.contains_delivery);
  return {
    ...session,
    messages,
    main_delivery_done: false,
    main_delivery: null,
    // Keep actions from prior delivery? Clear delivery-sourced ones is hard —
    // leave actions; regenerate will append. Prefer reset delivery-linked actions:
    actions: session.actions.filter((a) => !a.action_id.startsWith("delivery-")),
  };
}

/**
 * QA / ops: re-run Phase 4 book without walking stages 1–3 again.
 * API is called with regenerate:true (no second pass charge).
 */
export async function startDeliveryRegenerate(input: {
  session: POJUSessionState;
  locale: string;
}): Promise<POJUSessionState> {
  const cleaned = stripDeliveryForRegenerate(input.session);
  if (!cleaned.agent_v2?.breakthrough_core && cleaned.agent_v2?.delivery_mode !== "degraded") {
    throw new Error("breakthrough_core required to regenerate full delivery");
  }
  return runFinalDeliveryForSession(cleaned, input.locale, {
    delivery_mode: cleaned.agent_v2?.delivery_mode ?? "full",
    regenerate: true,
  });
}
