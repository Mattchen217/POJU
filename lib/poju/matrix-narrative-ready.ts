import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { hasPreviewMatrixMessage, isPreviewSession } from "@/lib/poju/preview-unlock";
import type { POJUSessionState } from "@/lib/poju/types";

export function isMatrixNarrativeReady(payload: PojuMatrixPayload | undefined | null): boolean {
  if (!payload?.display) return false;
  const src = payload.display.narrative_source;
  return (
    src === "llm" ||
    src === "stored" ||
    src === "template" ||
    payload.display.narrative_failed === true
  );
}

/** Preview chat may open only after matrix message exists and narrative finished (LLM or fallback). */
export function sessionMatrixReadyForChat(session: POJUSessionState): boolean {
  if (!isPreviewSession(session)) return true;
  if (!hasPreviewMatrixMessage(session)) return false;
  return isMatrixNarrativeReady(session.matrix_payload);
}

export function needsPreviewMatrixPreparation(session: POJUSessionState): boolean {
  return isPreviewSession(session) && !sessionMatrixReadyForChat(session);
}
