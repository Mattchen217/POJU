import { requestMatrixNarrative } from "@/lib/llm/deepseek/matrix-narrative";
import {
  applyMatrixNarrativeToPayload,
  markMatrixNarrativeFailed,
} from "@/lib/poju/apply-matrix-narrative";
import { refreshMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { isMatrixNarrativeReady } from "@/lib/poju/matrix-narrative-ready";
import {
  bindPreviewProfileToSession,
  createEnergyMatrixMessage,
  hasPreviewMatrixMessage,
} from "@/lib/poju/preview-unlock";
import type { POJUSessionState } from "@/lib/poju/types";

export async function finalizePreviewMatrixSession(
  session: POJUSessionState,
  locale: string,
  options?: { signal?: AbortSignal },
): Promise<POJUSessionState> {
  let working = session;

  if (!working.matrix_payload && working.selected_stored_profile_id) {
    working = await bindPreviewProfileToSession(
      working,
      working.selected_stored_profile_id,
      locale,
    );
  }

  let payload = working.matrix_payload;
  if (!payload) {
    throw new Error("Matrix payload missing");
  }

  payload = refreshMatrixPayload(payload, locale);

  let finalPayload = payload;
  if (!isMatrixNarrativeReady(payload)) {
    try {
      const narrative = await requestMatrixNarrative({
        matrix_payload: payload,
        locale,
        signal: options?.signal,
      });
      finalPayload = applyMatrixNarrativeToPayload(payload, narrative);
    } catch {
      finalPayload = markMatrixNarrativeFailed(payload);
    }
  }

  const matrixMsg = createEnergyMatrixMessage(finalPayload, locale);
  const messages = hasPreviewMatrixMessage(working)
    ? working.messages.map((m) =>
        m.meta?.kind === "energy_matrix"
          ? {
              ...m,
              meta: { ...m.meta, matrix_payload: finalPayload },
            }
          : m,
      )
    : [...working.messages, matrixMsg];

  return {
    ...working,
    matrix_payload: finalPayload,
    messages,
  };
}
