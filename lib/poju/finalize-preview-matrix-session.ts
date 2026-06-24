import {
  applyStoredMatrixPreview,
  resolveProfileMatrixPayloadWithoutLlm,
} from "@/lib/poju/resolve-matrix-preview";
import { isMatrixNarrativeReady } from "@/lib/poju/matrix-narrative-ready";
import {
  bindPreviewProfileToSession,
  createEnergyMatrixMessage,
  dedupePreviewMatrixMessages,
  hasPreviewMatrixMessage,
} from "@/lib/poju/preview-unlock";
import { seedFixedWelcomeMessages } from "@/lib/poju/chat-bootstrap";
import { loadPOJUSession } from "@/lib/poju/session-manager";
import { getStoredProfile, storedMatrixListPresent } from "@/lib/profile/stored-profiles-service";
import type { POJUSessionState } from "@/lib/poju/types";

/** Resolve matrix payload for preview — stored list or static fallback, never LLM. */
async function resolvePreviewMatrixPayload(
  session: POJUSessionState,
  locale: string,
): Promise<NonNullable<POJUSessionState["matrix_payload"]>> {
  const profileId = session.selected_stored_profile_id;
  const payload = session.matrix_payload;
  if (!profileId || !payload?.user_profile) {
    throw new Error("Profile missing for matrix preview");
  }

  const row = await getStoredProfile(profileId);
  if (storedMatrixListPresent(row)) {
    return applyStoredMatrixPreview(payload, row!.matrix_list!, "poju", locale);
  }

  if (isMatrixNarrativeReady(payload) && payload.display?.narrative_source === "stored") {
    return payload;
  }

  return resolveProfileMatrixPayloadWithoutLlm({
    profileId,
    userProfile: payload.user_profile,
    locale,
    product: "poju",
  });
}

/**
 * Preview prepare → chat: one energy_matrix bubble + fixed welcome, no LLM.
 * Reloads persisted session first (Strict Mode / double-run safe).
 */
export async function finalizePreviewMatrixSession(
  session: POJUSessionState,
  locale: string,
  options?: { signal?: AbortSignal },
): Promise<POJUSessionState> {
  void options?.signal;

  let working = (await loadPOJUSession(session.session_id)) ?? session;
  working = dedupePreviewMatrixMessages(working);

  if (!working.matrix_payload && working.selected_stored_profile_id) {
    working = await bindPreviewProfileToSession(
      working,
      working.selected_stored_profile_id,
      locale,
    );
  }

  if (!working.matrix_payload) {
    throw new Error("Matrix payload missing");
  }

  const finalPayload = await resolvePreviewMatrixPayload(working, locale);

  const messages = hasPreviewMatrixMessage(working)
    ? working.messages.map((m) =>
        m.meta?.kind === "energy_matrix"
          ? {
              ...m,
              meta: { ...m.meta, matrix_payload: finalPayload },
            }
          : m,
      )
    : [...working.messages, createEnergyMatrixMessage(finalPayload, locale)];

  let next: POJUSessionState = dedupePreviewMatrixMessages({
    ...working,
    matrix_payload: finalPayload,
    messages,
  });
  next = seedFixedWelcomeMessages(next, locale);
  return dedupePreviewMatrixMessages(next);
}
