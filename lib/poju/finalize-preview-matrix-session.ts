import {
  applyMatrixPreviewToPayload,
  applyStoredMatrixPreview,
  ensureProfileMatrixList,
} from "@/lib/poju/resolve-matrix-preview";
import {
  bindPreviewProfileToSession,
  dedupePreviewMatrixMessages,
  upsertEnergyMatrixMessage,
} from "@/lib/poju/preview-unlock";
import { dedupeWelcomeMessages, seedMatrixWelcomeMessage } from "@/lib/poju/chat-bootstrap";
import { loadPOJUSession } from "@/lib/poju/session-manager";
import { getStoredProfile, storedMatrixListPresent } from "@/lib/profile/stored-profiles-service";
import type { POJUSessionState } from "@/lib/poju/types";

/**
 * Preview prepare → chat matrix payload.
 * Old profile (stored matrix_list): no LLM. New profile: one matrix-narrative LLM call + persist.
 */
async function resolvePreviewMatrixPayload(
  session: POJUSessionState,
  locale: string,
  signal?: AbortSignal,
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

  const ensured = await ensureProfileMatrixList({
    profileId,
    userProfile: payload.user_profile,
    locale,
    signal,
  });
  return applyMatrixPreviewToPayload(payload, ensured, "poju", locale);
}

/**
 * Preview prepare → chat: one energy_matrix bubble + matrix welcome (avatar chat), no generic welcome.
 * Reloads persisted session first (Strict Mode / double-run safe).
 */
export async function finalizePreviewMatrixSession(
  session: POJUSessionState,
  locale: string,
  options?: { signal?: AbortSignal },
): Promise<POJUSessionState> {
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

  const finalPayload = await resolvePreviewMatrixPayload(
    working,
    locale,
    options?.signal,
  );

  const messages = upsertEnergyMatrixMessage(working.messages, finalPayload, locale);

  let next: POJUSessionState = dedupePreviewMatrixMessages({
    ...working,
    matrix_payload: finalPayload,
    messages,
  });
  next = seedMatrixWelcomeMessage(next, locale);
  return dedupeWelcomeMessages(dedupePreviewMatrixMessages(next));
}
