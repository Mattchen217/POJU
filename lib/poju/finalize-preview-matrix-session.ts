import {
  applyMatrixPreviewToPayload,
  ensureProfileMatrixList,
} from "@/lib/poju/resolve-matrix-preview";
import { refreshMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { isMatrixNarrativeReady } from "@/lib/poju/matrix-narrative-ready";
import {
  bindPreviewProfileToSession,
  createEnergyMatrixMessage,
  hasPreviewMatrixMessage,
} from "@/lib/poju/preview-unlock";
import { markMatrixNarrativeFailed } from "@/lib/poju/apply-matrix-narrative";
import { getOnboardingCopy } from "@/lib/poju/onboarding-templates";
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

  const profileId = working.selected_stored_profile_id;
  if (!profileId || !payload.user_profile) {
    throw new Error("Profile missing for matrix preview");
  }

  payload = refreshMatrixPayload(payload, locale);

  let finalPayload = payload;
  if (!isMatrixNarrativeReady(payload)) {
    try {
      const ensured = await ensureProfileMatrixList({
        profileId,
        userProfile: payload.user_profile,
        locale,
        signal: options?.signal,
      });
      finalPayload = applyMatrixPreviewToPayload(payload, ensured, "poju", locale);
    } catch {
      const failed = markMatrixNarrativeFailed(payload);
      const display = failed.display;
      finalPayload =
        display != null
          ? {
              ...failed,
              display: {
                ...display,
                synopsis: {
                  ...display.synopsis,
                  prompt: getOnboardingCopy("poju", locale),
                },
              },
            }
          : failed;
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
