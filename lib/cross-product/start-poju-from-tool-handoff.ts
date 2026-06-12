import type { ToolName } from "@/lib/poju/types";
import { getToolResult } from "@/lib/cross-product/get-tool-result";
import {
  readFromToolPending,
  setFromToolPending,
  stashToolResultForHandoff,
} from "@/lib/cross-product/from-tool-pending";
import { buildSuggestedQuestionFromTool } from "@/lib/cross-product/suggested-question-from-tool";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { POJU_PENDING_STORED_PROFILE_KEY } from "@/lib/poju/pending-stored-profile";

/**
 * Delivery-page handoff: stash tool context → mock payment → payment-success creates a new POJU session.
 */
export async function startPojuFromToolHandoff(input: {
  tool: ToolName;
  resultId: string;
  resultData: Record<string, unknown>;
  locale: string;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const suggested = buildSuggestedQuestionFromTool(input.tool, input.resultData);
  stashToolResultForHandoff(input.tool, input.resultId, input.resultData);
  setFromToolPending({
    tool: input.tool,
    result_id: input.resultId,
    result_data: input.resultData,
    suggested_question: suggested,
  });
  sessionStorage.setItem("poju_pending_question", suggested);

  const primaryProfileId = input.resultData.primary_profile_id;
  if (typeof primaryProfileId === "string" && primaryProfileId.trim()) {
    sessionStorage.setItem(POJU_PENDING_STORED_PROFILE_KEY, primaryProfileId.trim());
  }

  const returnUrl = `${window.location.origin}/${input.locale}/poju/payment-success`;
  const pay = await fetch("/api/payments/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      product: "poju",
      locale: input.locale,
      amount: 9.99,
      device_id: getPojuDeviceId(),
      return_url: returnUrl,
    }),
  });

  const payload = (await pay.json()) as {
    checkout_url?: string;
    payment_url?: string;
    order_id?: string;
  };
  const target = payload.payment_url ?? payload.checkout_url;
  if (!target || !payload.order_id) return false;

  sessionStorage.setItem("poju_pending_order_id", payload.order_id);
  window.location.href = target;
  return true;
}

/** Resolve the richest available payload before starting payment. */
export async function resolveToolHandoffPayload(
  tool: ToolName,
  resultId: string,
  fallback: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const loaded = await getToolResult(tool, resultId);
  return loaded ?? fallback;
}

export function readPendingToolHandoffQuestion(): string | null {
  const pending = readFromToolPending();
  if (pending?.suggested_question?.trim()) return pending.suggested_question.trim();
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("poju_pending_question")?.trim() || null;
}
