/**
 * Atmos prepare: local matrix only (no POJU chat session).
 */

import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { resolveProfileMatrixPayload } from "@/lib/poju/resolve-matrix-preview";
import { getStoredProfile, recordProfileUsage } from "@/lib/profile/stored-profiles-service";

export type AtmosPrepareResult = {
  matrixPayload: PojuMatrixPayload;
  fromStorage: boolean;
};

export async function finalizeAtmosPrepare(
  profileId: string,
  locale: string,
  options?: { signal?: AbortSignal },
): Promise<AtmosPrepareResult> {
  const signal = options?.signal;
  const stored = await getStoredProfile(profileId);
  if (!stored?.user_profile) {
    throw new Error("Profile not found");
  }

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  await recordProfileUsage(profileId, "atmos");

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

  return { matrixPayload, fromStorage };
}
