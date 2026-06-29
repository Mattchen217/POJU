import { getWelcomeMessage } from "@/lib/poju/welcome-messages";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import {
  getMatrixSynopsisPlainText,
  resolveMatrixDisplay,
} from "@/lib/poju/matrix-narrative-text";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";

export const MATRIX_WELCOME_MESSAGE_CLIENT_ID = "poju-matrix-welcome";

export function isFixedWelcomeContent(content: string): boolean {
  const text = content.toLowerCase();
  return (
    text.includes("this is a focused space for one question") ||
    text.includes("这里只围绕你今天带来的那一个核心问题")
  );
}

export function isMatrixWelcomeMessage(m: POJUMessage): boolean {
  return m.role === "assistant" && m.meta?.kind === "welcome" && m.meta.matrix_welcome === true;
}

export function hasMatrixWelcomeMessage(session: POJUSessionState): boolean {
  return session.messages.some(isMatrixWelcomeMessage);
}

export function hasFixedWelcomeMessage(session: POJUSessionState): boolean {
  return session.messages.some(
    (m) =>
      isMatrixWelcomeMessage(m) ||
      (m.role === "assistant" && (m.meta?.kind === "welcome" || isFixedWelcomeContent(m.content))),
  );
}

export function createWelcomeAssistantMessage(locale: string): POJUMessage {
  return {
    role: "assistant",
    content: getWelcomeMessage(locale),
    timestamp: new Date().toISOString(),
    meta: { kind: "welcome" },
  };
}

export function createMatrixWelcomeMessage(
  payload: PojuMatrixPayload,
  locale: string,
): POJUMessage {
  const display = resolveMatrixDisplay(payload, locale);
  return {
    role: "assistant",
    content: getMatrixSynopsisPlainText(display, locale),
    client_id: MATRIX_WELCOME_MESSAGE_CLIENT_ID,
    timestamp: new Date().toISOString(),
    meta: {
      kind: "welcome",
      matrix_welcome: true,
      matrix_payload: payload,
    },
  };
}

/** Drop generic welcome when matrix welcome exists; keep at most one welcome bubble. */
export function dedupeWelcomeMessages(session: POJUSessionState): POJUSessionState {
  const welcomeIndices = session.messages
    .map((m, i) =>
      m.role === "assistant" &&
      (m.meta?.kind === "welcome" || isFixedWelcomeContent(m.content))
        ? i
        : -1,
    )
    .filter((i) => i >= 0);
  if (welcomeIndices.length <= 1) return session;

  const matrixIdx = welcomeIndices.find((i) => isMatrixWelcomeMessage(session.messages[i]!));
  const keepIdx = matrixIdx ?? welcomeIndices[0]!;
  return {
    ...session,
    messages: session.messages.filter(
      (m, i) =>
        !(
          m.role === "assistant" &&
          (m.meta?.kind === "welcome" || isFixedWelcomeContent(m.content)) &&
          i !== keepIdx
        ),
    ),
  };
}

/** Upsert matrix-sourced welcome — idempotent per session. */
export function upsertMatrixWelcomeMessage(
  session: POJUSessionState,
  payload: PojuMatrixPayload,
  locale: string,
): POJUSessionState {
  const fresh = createMatrixWelcomeMessage(payload, locale);
  const idx = session.messages.findIndex((m) => isMatrixWelcomeMessage(m));
  let messages: POJUMessage[];
  if (idx < 0) {
    messages = [...session.messages, fresh];
  } else {
    const existing = session.messages[idx]!;
    messages = session.messages.map((m, i) =>
      i === idx
        ? {
            ...fresh,
            timestamp: existing.timestamp,
            client_id: existing.client_id ?? fresh.client_id,
          }
        : m,
    );
  }
  return dedupeWelcomeMessages({ ...session, messages });
}

/** Preview / profile chat: matrix synopsis welcome — no generic copy, no LLM. */
export function seedMatrixWelcomeMessage(
  session: POJUSessionState,
  locale: string,
): POJUSessionState {
  if (!session.matrix_payload) return session;
  if (hasMatrixWelcomeMessage(session)) return dedupeWelcomeMessages(session);
  return upsertMatrixWelcomeMessage(session, session.matrix_payload, locale);
}

/** Append fixed welcome copy — no LLM. Idempotent per session. Skipped when profile has matrix. */
export function seedFixedWelcomeMessages(session: POJUSessionState, locale: string): POJUSessionState {
  if (resolveSessionHasProfile(session) && session.matrix_payload) {
    return seedMatrixWelcomeMessage(session, locale);
  }
  if (hasFixedWelcomeMessage(session)) return dedupeWelcomeMessages(session);
  return dedupeWelcomeMessages({
    ...session,
    messages: [...session.messages, createWelcomeAssistantMessage(locale)],
  });
}
