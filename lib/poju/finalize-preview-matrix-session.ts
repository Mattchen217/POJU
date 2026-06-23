import {
  applyStoredMatrixPreview,
  resolveProfileMatrixPayloadWithoutLlm,
} from "@/lib/poju/resolve-matrix-preview";
import { refreshMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { isMatrixNarrativeReady } from "@/lib/poju/matrix-narrative-ready";
import {
  bindPreviewProfileToSession,
  createEnergyMatrixMessage,
  hasPreviewMatrixMessage,
} from "@/lib/poju/preview-unlock";
import { seedFixedWelcomeMessages } from "@/lib/poju/chat-bootstrap";
import { getStoredProfile, storedMatrixListPresent } from "@/lib/profile/stored-profiles-service";
import type { POJUSessionState } from "@/lib/poju/types";

export async function finalizePreviewMatrixSession(
  session: POJUSessionState,
  locale: string,
  options?: { signal?: AbortSignal },
): Promise<POJUSessionState> {
  void options?.signal;
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

  const profileId = working.selected_stored_profile_id;
  if (!profileId || !payload.user_profile) {
    throw new Error("Profile missing for matrix preview");
  }

  payload = refreshMatrixPayload(payload, locale);

  let finalPayload = payload;
  if (!isMatrixNarrativeReady(payload)) {
    const row = await getStoredProfile(profileId);
    if (storedMatrixListPresent(row)) {
      finalPayload = applyStoredMatrixPreview(payload, row!.matrix_list!, "poju", locale);
    } else {
      finalPayload = await resolveProfileMatrixPayloadWithoutLlm({
        profileId,
        userProfile: payload.user_profile,
        locale,
        product: "poju",
      });
    }
  }

  const matrixMsg = createEnergyMatrixMessage(finalPayload, locale);
  let messages = hasPreviewMatrixMessage(working)
    ? working.messages.map((m) =>
        m.meta?.kind === "energy_matrix"
          ? {
              ...m,
              meta: { ...m.meta, matrix_payload: finalPayload },
            }
          : m,
      )
    : [...working.messages, matrixMsg];

  let next: POJUSessionState = {
    ...working,
    matrix_payload: finalPayload,
    messages,
  };
  next = seedFixedWelcomeMessages(next, locale);
  return next;
}
