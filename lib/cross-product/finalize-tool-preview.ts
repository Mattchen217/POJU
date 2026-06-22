import type { MatrixNarrativeResponse } from "@/lib/llm/prompts/matrix-narrative-prompt";
import {
  applyToolMatrixNarrativeFailed,
} from "@/lib/cross-product/apply-tool-matrix-narrative";
import { buildMatrixPayloadFromProfile, refreshMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import {
  applyMatrixPreviewToPayload,
  ensureProfileMatrixList,
} from "@/lib/poju/resolve-matrix-preview";
import type { ToolName } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

export type ToolPreviewResult = {
  matrix_payload: PojuMatrixPayload;
  matrix_payload_b: PojuMatrixPayload | null;
  narrative: MatrixNarrativeResponse | null;
};

/**
 * Tool free-preview layer: local matrix + matrix_list from storage or one-time backfill.
 * Match checks A/B independently; zero LLM when both profiles have matrix_list.
 */
export async function finalizeToolPreview(opts: {
  profileId: string;
  userProfile: UserProfile;
  profileBId?: string;
  userProfileB?: UserProfile;
  locale: string;
  product: ToolName;
  signal?: AbortSignal;
}): Promise<ToolPreviewResult> {
  const locale = opts.locale;

  let payloadA = buildMatrixPayloadFromProfile(opts.profileId, opts.userProfile, { locale });
  payloadA = refreshMatrixPayload(payloadA, locale);

  let payloadB: PojuMatrixPayload | null = null;
  if (opts.product === "match" && opts.userProfileB && opts.profileBId) {
    payloadB = buildMatrixPayloadFromProfile(opts.profileBId, opts.userProfileB, { locale });
    payloadB = refreshMatrixPayload(payloadB, locale);
  }

  const [ensuredA, ensuredB] = await Promise.all([
    ensureProfileMatrixList({
      profileId: opts.profileId,
      userProfile: opts.userProfile,
      locale,
      signal: opts.signal,
    }),
    opts.product === "match" && opts.userProfileB && opts.profileBId
      ? ensureProfileMatrixList({
          profileId: opts.profileBId,
          userProfile: opts.userProfileB,
          locale,
          signal: opts.signal,
        })
      : Promise.resolve(null),
  ]);

  const matrix_payload = applyMatrixPreviewToPayload(
    payloadA,
    ensuredA,
    opts.product,
    locale,
    opts.product === "match" ? "a" : undefined,
  );
  const matrix_payload_b = payloadB && ensuredB
    ? applyMatrixPreviewToPayload(payloadB, ensuredB, opts.product, locale, "b")
    : null;

  const narrative = ensuredA.narrative ?? ensuredB?.narrative ?? null;

  return { matrix_payload, matrix_payload_b, narrative };
}

/** Narrative failed path — static guide only, no LLM fields. */
export function finalizeToolPreviewOffline(opts: {
  profileId: string;
  userProfile: UserProfile;
  profileBId?: string;
  userProfileB?: UserProfile;
  locale: string;
  product: ToolName;
}): ToolPreviewResult {
  let payloadA = buildMatrixPayloadFromProfile(opts.profileId, opts.userProfile, {
    locale: opts.locale,
  });
  payloadA = refreshMatrixPayload(payloadA, opts.locale);

  let payloadB: PojuMatrixPayload | null = null;
  if (opts.product === "match" && opts.userProfileB && opts.profileBId) {
    payloadB = buildMatrixPayloadFromProfile(opts.profileBId, opts.userProfileB, {
      locale: opts.locale,
    });
    payloadB = refreshMatrixPayload(payloadB, opts.locale);
  }

  return {
    matrix_payload: applyToolMatrixNarrativeFailed(payloadA, opts.product, opts.locale),
    matrix_payload_b: payloadB
      ? applyToolMatrixNarrativeFailed(payloadB, opts.product, opts.locale)
      : null,
    narrative: null,
  };
}
