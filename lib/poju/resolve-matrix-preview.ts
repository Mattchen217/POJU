/**
 * Persist template-only matrix preview (no LLM).
 * Front-of-paywall copy must be 100% controllable — PART 2 cancels matrix-narrative model calls.
 */

import type { StoredProfileMatrixList } from "@/lib/db/poju-db";
import type { MatrixDisplayData } from "@/lib/poju/build-matrix-display";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { buildMatrixPayloadFromProfile, refreshMatrixPayload } from "@/lib/poju/build-matrix-payload";
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
  /** Always null — LLM narrative path removed (PART 2). */
  narrative: null;
  fromStorage: boolean;
  template_only: boolean;
};

export function matrixListFromTemplateDisplay(
  display: MatrixDisplayData,
  locale: string,
): StoredProfileMatrixList {
  return {
    elemental_breakdown: {
      caption: display.enote_caption ?? "",
    },
    structural_dynamics: display.structural_dynamics,
    annual_transit_2026: {
      title: display.annual_transit.stem_en || String(display.annual_transit.year),
      description: display.annual_transit.narrative,
    },
    generated_at: new Date().toISOString(),
    locale,
    poju_onboarding: {
      archetype_intro: display.synopsis.archetype,
      core_conflict: display.synopsis.friction,
      call_to_action: display.synopsis.prompt || getOnboardingCopy("poju", locale),
    },
  };
}

export function applyMatrixListToDisplay(
  display: MatrixDisplayData,
  list: StoredProfileMatrixList,
): MatrixDisplayData {
  return {
    ...display,
    enote_caption: list.elemental_breakdown.caption || display.enote_caption,
    // Keep local fact_panel; do not overlay stored prose onto lifecycle cards.
    fact_panel: display.fact_panel,
    structural_dynamics: list.structural_dynamics ?? display.structural_dynamics,
    annual_transit: {
      ...display.annual_transit,
      stem_en:
        list.annual_transit_2026.title.split("/")[0]?.trim() || display.annual_transit.stem_en,
      narrative: list.annual_transit_2026.description || display.annual_transit.narrative,
    },
    narrative_source: "template",
    narrative_failed: false,
    narrative_locale: list.locale,
    synopsis: list.poju_onboarding
      ? {
          archetype: list.poju_onboarding.archetype_intro,
          friction: list.poju_onboarding.core_conflict,
          prompt: list.poju_onboarding.call_to_action,
        }
      : display.synopsis,
  };
}

export function applyStoredMatrixPreview(
  payload: PojuMatrixPayload,
  list: StoredProfileMatrixList,
  product: MatrixPreviewProduct,
  locale: string,
  _matchPerson?: "a" | "b",
): PojuMatrixPayload {
  const display = payload.display;
  if (!display) return payload;

  const guide = getOnboardingCopy(product, locale);
  const updatedDisplay = applyMatrixListToDisplay(display, list);

  if (product === "poju") {
    const onboarding = list.poju_onboarding;
    return {
      ...payload,
      display: {
        ...updatedDisplay,
        synopsis: onboarding
          ? {
              archetype: onboarding.archetype_intro,
              friction: onboarding.core_conflict,
              prompt: onboarding.call_to_action || guide,
            }
          : {
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

/** Read stored matrix_list or build + persist deterministic template (zero LLM). */
export async function ensureProfileMatrixList(opts: {
  profileId: string;
  userProfile: UserProfile;
  locale: string;
  signal?: AbortSignal;
}): Promise<EnsureMatrixListResult> {
  void opts.signal;
  const row = await getStoredProfile(opts.profileId);
  if (storedMatrixListPresent(row)) {
    return {
      list: row!.matrix_list!,
      narrative: null,
      fromStorage: true,
      template_only: true,
    };
  }

  let payload = buildMatrixPayloadFromProfile(opts.profileId, opts.userProfile, {
    locale: opts.locale,
  });
  payload = refreshMatrixPayload(payload, opts.locale);
  const display = payload.display;
  if (!display) {
    console.warn("[fallback] ensureProfileMatrixList: no display — cannot persist template", {
      profile_id: opts.profileId,
      reason: "missing_display",
    });
    return { list: null, narrative: null, fromStorage: false, template_only: true };
  }

  const list = matrixListFromTemplateDisplay(display, opts.locale);
  try {
    await saveMatrixList(opts.profileId, list);
  } catch (e) {
    console.warn("[fallback] ensureProfileMatrixList: saveMatrixList failed", {
      profile_id: opts.profileId,
      reason: e instanceof Error ? e.message : String(e),
    });
  }
  return { list, narrative: null, fromStorage: false, template_only: true };
}

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

export function applyMatrixPreviewToPayload(
  payload: PojuMatrixPayload,
  ensured: EnsureMatrixListResult,
  product: MatrixPreviewProduct,
  locale: string,
  matchPerson?: "a" | "b",
): PojuMatrixPayload {
  void matchPerson;
  if (ensured.list) {
    return applyStoredMatrixPreview(payload, ensured.list, product, locale);
  }
  console.warn("[fallback] applyMatrixPreviewToPayload: using in-memory template", {
    reason: "no_persisted_list",
    product,
  });
  return buildStaticMatrixPreviewPayload(payload, product, locale);
}

/** Matrix preview without LLM — stored matrix_list or deterministic static fallback. */
export function buildStaticMatrixPreviewPayload(
  payload: PojuMatrixPayload,
  product: MatrixPreviewProduct,
  locale: string,
): PojuMatrixPayload {
  const display = payload.display;
  if (!display) return payload;
  return {
    ...payload,
    display: {
      ...display,
      narrative_source: "template",
      narrative_failed: false,
      synopsis: {
        ...display.synopsis,
        prompt: getOnboardingCopy(product, locale),
      },
      narrative_locale: locale,
    },
  };
}

/** Sync-friendly: prefer stored list, else refresh template display (no LLM). */
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
