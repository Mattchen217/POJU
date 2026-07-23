/**
 * Workspace confirm → prepare: local matrix calc (ensureProfileMatrixList),
 * session bind, welcome only (energy chart lives in the right rail).
 */

import { seedMatrixWelcomeMessage, dedupeWelcomeMessages } from "@/lib/poju/chat-bootstrap";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { bindPreviewProfileToSession } from "@/lib/poju/preview-unlock";
import { resolveProfileMatrixPayload } from "@/lib/poju/resolve-matrix-preview";
import { createPOJUSession, loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import type { POJUSessionState } from "@/lib/poju/types";
import { getStoredProfile, recordProfileUsage } from "@/lib/profile/stored-profiles-service";

export type WorkspacePrepareResult = {
  session: POJUSessionState;
  matrixPayload: PojuMatrixPayload;
  fromStorage: boolean;
};

/**
 * Create/bind a POJU session, run local matrix calculation (or reuse cached matrix_list),
 * persist list, and seed matrix welcome — without injecting the energy-matrix chat bubble.
 */
export async function finalizeWorkspacePrepare(
  profileId: string,
  locale: string,
  options?: { signal?: AbortSignal },
): Promise<WorkspacePrepareResult> {
  const signal = options?.signal;
  const stored = await getStoredProfile(profileId);
  if (!stored?.user_profile) {
    throw new Error("Profile not found");
  }

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const sessionId = await createPOJUSession({
    payment_id: `workspace-${profileId}`,
    original_question: "",
    selected_stored_profile_id: profileId,
  });

  let session = await loadPOJUSession(sessionId);
  if (!session) throw new Error("Session not found");

  session = await bindPreviewProfileToSession(session, profileId, locale);
  await recordProfileUsage(profileId, "poju");

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const matrixPayload = await resolveProfileMatrixPayload({
    profileId,
    userProfile: stored.user_profile,
    locale,
    product: "poju",
    signal,
  });

  const rowAfter = await getStoredProfile(profileId);
  const fromStorage = Boolean(rowAfter?.matrix_list);

  session = {
    ...session,
    matrix_payload: matrixPayload,
    // Do not upsert energy_matrix message — chart renders in the workspace right rail.
    messages: session.messages.filter((m) => m.meta?.kind !== "energy_matrix"),
  };
  session = seedMatrixWelcomeMessage(session, locale);
  session = dedupeWelcomeMessages(session);

  await savePOJUSession(session);

  return { session, matrixPayload, fromStorage };
}
