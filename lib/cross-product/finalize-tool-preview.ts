import { requestMatrixNarrative } from "@/lib/llm/deepseek/matrix-narrative";
import type { MatrixNarrativeResponse } from "@/lib/llm/prompts/matrix-narrative-prompt";
import {
  applyToolMatrixNarrative,
  applyToolMatrixNarrativeFailed,
} from "@/lib/cross-product/apply-tool-matrix-narrative";
import { buildMatrixPayloadFromProfile, refreshMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { ToolName } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

export type ToolPreviewResult = {
  matrix_payload: PojuMatrixPayload;
  matrix_payload_b: PojuMatrixPayload | null;
  narrative: MatrixNarrativeResponse | null;
};

/**
 * Tool free-preview layer: local matrix (zero LLM) + one light matrix-narrative call.
 * Match returns A/B payloads; narrative order is A → B → guide.
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

  let narrative: MatrixNarrativeResponse | null = null;
  try {
    narrative = await requestMatrixNarrative({
      matrix_payload: payloadA,
      matrix_payload_b: payloadB ?? undefined,
      locale,
      product: opts.product,
      signal: opts.signal,
    });
  } catch {
    narrative = null;
  }

  const matrix_payload = applyToolMatrixNarrative(
    payloadA,
    narrative,
    opts.product,
    locale,
  );
  const matrix_payload_b = payloadB
    ? applyToolMatrixNarrative(payloadB, narrative, opts.product, locale)
    : null;

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
