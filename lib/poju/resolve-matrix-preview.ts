import type { StoredProfileMatrixList } from "@/lib/db/poju-db";
import { applyToolMatrixNarrative, applyToolMatrixNarrativeFailed } from "@/lib/cross-product/apply-tool-matrix-narrative";
import { requestMatrixNarrative } from "@/lib/llm/deepseek/matrix-narrative";
import type { MatrixNarrativeResponse } from "@/lib/llm/prompts/matrix-narrative-prompt";
import {
  applyMatrixNarrativeToDisplay,
  applyMatrixNarrativeToPayload,
  markMatrixNarrativeFailed,
} from "@/lib/poju/apply-matrix-narrative";
import type { MatrixDisplayData } from "@/lib/poju/build-matrix-display";
import { buildMatrixPayloadFromProfile, refreshMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { getOnboardingCopy } from "@/lib/poju/onboarding-templates";
import type { ToolName } from "@/lib/poju/types";
import {
  getStoredProfile,
  saveMatrixList,
  storedMatrixListPresent,
} from "@/lib/profile/stored-profiles-service";
import type { UserProfile } from "@/lib/profile/types";

export type MatrixPreviewProduct = ToolName | "poju";

export type EnsureMatrixListResult = {
  list: StoredProfileMatrixList | null;
  narrative: MatrixNarrativeResponse | null;
  fromStorage: boolean;
};

export function matrixListFromNarrative(
  narrative: MatrixNarrativeResponse,
  locale: string,
): StoredProfileMatrixList {
  return {
    elemental_breakdown: narrative.elemental_breakdown,
    structural_dynamics: narrative.structural_dynamics,
    annual_transit_2026: narrative.annual_transit_2026,
    generated_at: new Date().toISOString(),
    locale,
  };
}

export function applyMatrixListToDisplay(
  display: MatrixDisplayData,
  list: StoredProfileMatrixList,
): MatrixDisplayData {
  return {
    ...display,
    enote_caption: list.elemental_breakdown.caption,
    structural_dynamics: list.structural_dynamics,
    annual_transit: {
      ...display.annual_transit,
      stem_en:
        list.annual_transit_2026.title.split("/")[0]?.trim() || display.annual_transit.stem_en,
      narrative: list.annual_transit_2026.description,
    },
    narrative_source: "stored",
    narrative_failed: false,
    narrative_locale: list.locale,
  };
}

export function applyStoredMatrixPreview(
  payload: PojuMatrixPayload,
  list: StoredProfileMatrixList,
  product: MatrixPreviewProduct,
  locale: string,
  matchPerson?: "a" | "b",
): PojuMatrixPayload {
  const display = payload.display;
  if (!display) return payload;

  const guide = getOnboardingCopy(product, locale);
  const updatedDisplay = applyMatrixListToDisplay(display, list);

  if (product === "match") {
    return {
      ...payload,
      display: {
        ...updatedDisplay,
        synopsis: {
          ...updatedDisplay.synopsis,
          prompt: guide,
        },
      },
    };
  }

  if (product === "poju") {
    return {
      ...payload,
      display: {
        ...updatedDisplay,
        synopsis: {
          ...updatedDisplay.synopsis,
          prompt: guide,
        },
      },
    };
  }

  return {
    ...payload,
    display: {
      ...updatedDisplay,
      synopsis: {
        ...updatedDisplay.synopsis,
        prompt: guide,
      },
    },
  };
}

/** Read stored matrix_list or generate once (full poju prompt) and persist. */
export async function ensureProfileMatrixList(opts: {
  profileId: string;
  userProfile: UserProfile;
  locale: string;
  signal?: AbortSignal;
}): Promise<EnsureMatrixListResult> {
  const row = await getStoredProfile(opts.profileId);
  if (storedMatrixListPresent(row)) {
    return { list: row!.matrix_list!, narrative: null, fromStorage: true };
  }

  let payload = buildMatrixPayloadFromProfile(opts.profileId, opts.userProfile, {
    locale: opts.locale,
  });
  payload = refreshMatrixPayload(payload, opts.locale);

  try {
    const narrative = await requestMatrixNarrative({
      matrix_payload: payload,
      locale: opts.locale,
      product: "poju",
      signal: opts.signal,
    });

    const list = matrixListFromNarrative(narrative, opts.locale);
    await saveMatrixList(opts.profileId, list);
    return { list, narrative, fromStorage: false };
  } catch (e) {
    console.warn(
      "[ensureProfileMatrixList] matrix narrative failed — static matrix fallback",
      e instanceof Error ? e.message : String(e),
    );
    return { list: null, narrative: null, fromStorage: false };
  }
}

/**
 * Profile view / report modal: stored matrix_list or one-time legacy backfill, then payload for UI.
 */
export async function resolveProfileMatrixPayload(opts: {
  profileId: string;
  userProfile: UserProfile;
  locale: string;
  product?: MatrixPreviewProduct;
  signal?: AbortSignal;
}): Promise<PojuMatrixPayload> {
  let payload = buildMatrixPayloadFromProfile(opts.profileId, opts.userProfile, {
    locale: opts.locale,
  });
  payload = refreshMatrixPayload(payload, opts.locale);
  const product = opts.product ?? "poju";

  const row = await getStoredProfile(opts.profileId);
  if (storedMatrixListPresent(row)) {
    return applyStoredMatrixPreview(payload, row!.matrix_list!, product, opts.locale);
  }

  const ensured = await ensureProfileMatrixList({
    profileId: opts.profileId,
    userProfile: opts.userProfile,
    locale: opts.locale,
    signal: opts.signal,
  });
  return applyMatrixPreviewToPayload(payload, ensured, product, opts.locale);
}

export function applyFreshNarrativeToPayload(
  payload: PojuMatrixPayload,
  narrative: MatrixNarrativeResponse,
  product: MatrixPreviewProduct,
  locale: string,
  matchPerson?: "a" | "b",
): PojuMatrixPayload {
  if (product === "poju") {
    return applyMatrixNarrativeToPayload(payload, narrative, locale);
  }
  return applyToolMatrixNarrative(payload, narrative, product, locale, matchPerson);
}

export function applyMatrixPreviewToPayload(
  payload: PojuMatrixPayload,
  ensured: EnsureMatrixListResult,
  product: MatrixPreviewProduct,
  locale: string,
  matchPerson?: "a" | "b",
): PojuMatrixPayload {
  if (ensured.fromStorage) {
    if (!ensured.list) {
      throw new Error("Stored matrix preview missing matrix_list");
    }
    return applyStoredMatrixPreview(payload, ensured.list, product, locale, matchPerson);
  }
  if (ensured.narrative) {
    return applyFreshNarrativeToPayload(payload, ensured.narrative, product, locale, matchPerson);
  }
  if (product === "poju") {
    const failed = markMatrixNarrativeFailed(payload);
    const display = failed.display;
    if (!display) return failed;
    return {
      ...failed,
      display: {
        ...display,
        synopsis: {
          ...display.synopsis,
          prompt: getOnboardingCopy("poju", locale),
        },
      },
    };
  }
  return applyToolMatrixNarrativeFailed(payload, product, locale);
}

/** Matrix preview without LLM — stored matrix_list or deterministic static fallback. */
export function buildStaticMatrixPreviewPayload(
  payload: PojuMatrixPayload,
  product: MatrixPreviewProduct,
  locale: string,
): PojuMatrixPayload {
  const failed = markMatrixNarrativeFailed(payload);
  const display = failed.display;
  if (!display) return failed;
  return {
    ...failed,
    display: {
      ...display,
      narrative_source: "stored",
      synopsis: {
        ...display.synopsis,
        prompt: getOnboardingCopy(product, locale),
      },
      narrative_locale: locale,
    },
  };
}

/**
 * Profile view / preview prep / report modal — never calls matrix narrative LLM.
 */
export async function resolveProfileMatrixPayloadWithoutLlm(opts: {
  profileId: string;
  userProfile: UserProfile;
  locale: string;
  product?: MatrixPreviewProduct;
}): Promise<PojuMatrixPayload> {
  let payload = buildMatrixPayloadFromProfile(opts.profileId, opts.userProfile, {
    locale: opts.locale,
  });
  payload = refreshMatrixPayload(payload, opts.locale);
  const product = opts.product ?? "poju";

  const row = await getStoredProfile(opts.profileId);
  if (storedMatrixListPresent(row)) {
    return applyStoredMatrixPreview(payload, row!.matrix_list!, product, opts.locale);
  }

  return buildStaticMatrixPreviewPayload(payload, product, opts.locale);
}
