/**
 * Full personal-profile context for DI2 Personalized Understanding turns.
 * Authority: local ProfileStructured + Ziwei fact pack — model must not invent chart data.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { computeProfileHash } from "@/lib/poju/decision-intake/personal-analysis";
import type { UserProfile } from "@/lib/profile/types";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  bindPersonalAnalysisProfile,
  type PersonalAnalysisProfile,
} from "./personal-analysis-profile";

export type PersonalProfileContextAvailability = {
  bazi: "available" | "missing" | "incomplete";
  ziwei: "available" | "missing" | "incomplete" | "failed";
};

export type PersonalProfileFieldCoverage = {
  four_pillars: boolean;
  pillars_detail: boolean;
  day_master: boolean;
  strength: boolean;
  pattern: boolean;
  yong_xi_ji: boolean;
  da_yun: boolean;
  bazi_enrichment: boolean;
  ziwei_closed_set: boolean;
};

export type PersonalProfileContext = {
  profile_id: string | null;
  profile_hash: string | null;
  calculated_at: string | null;
  data_availability: PersonalProfileContextAvailability;
  /** Full local BaZi / enrichment structured chart (never model-invented). */
  structured: ProfileStructured | null;
  /** Closed-set Ziwei text for prompt (local iztro). */
  ziwei_closed_set: string | null;
  /** Which authority field groups are present this turn. */
  field_coverage: PersonalProfileFieldCoverage;
  /**
   * True when Session claims a birth/profile but authority structured chart
   * could not be loaded — callers must not pretend personalization succeeded.
   */
  personalization_incomplete: boolean;
  /** Thin QA binding kept for legacy consumers. */
  qa_binding: PersonalAnalysisProfile;
};

function emptyCoverage(): PersonalProfileFieldCoverage {
  return {
    four_pillars: false,
    pillars_detail: false,
    day_master: false,
    strength: false,
    pattern: false,
    yong_xi_ji: false,
    da_yun: false,
    bazi_enrichment: false,
    ziwei_closed_set: false,
  };
}

export function computePersonalProfileFieldCoverage(input: {
  structured: ProfileStructured | null;
  ziwei_closed_set: string | null;
}): PersonalProfileFieldCoverage {
  const s = input.structured;
  if (!s) {
    return {
      ...emptyCoverage(),
      ziwei_closed_set: Boolean(input.ziwei_closed_set?.trim()),
    };
  }
  return {
    four_pillars: Boolean(
      s.four_pillars?.year &&
        s.four_pillars?.month &&
        s.four_pillars?.day &&
        s.four_pillars?.hour,
    ),
    pillars_detail: Boolean(s.pillars_detail?.day?.stem),
    day_master: Boolean(s.day_master?.trim()),
    strength: Boolean(s.strength),
    pattern: Boolean(s.pattern?.trim()),
    yong_xi_ji: Boolean(s.yong_shen?.trim() || (s.xi_shen?.length ?? 0) > 0),
    da_yun: Array.isArray(s.da_yun) && s.da_yun.length > 0,
    bazi_enrichment: Boolean(s.bazi_enrichment),
    ziwei_closed_set: Boolean(input.ziwei_closed_set?.trim()),
  };
}

/**
 * If matrix.structured is missing but birth/user_profile exists, rebuild via
 * the same local authority path as Matrix (never invent chart data).
 */
function resolveStructuredFromSession(
  session: POJUSessionState,
): { structured: ProfileStructured | null; rebuilt: boolean; rebuild_failed: boolean } {
  const matrix = session.matrix_payload;
  if (matrix?.structured?.day_master?.trim()) {
    return { structured: matrix.structured as ProfileStructured, rebuilt: false, rebuild_failed: false };
  }
  const profile = matrix?.user_profile;
  const profileId =
    matrix?.profile_id ??
    session.selected_stored_profile_id ??
    session.agent_v2?.selected_profile_id ??
    profile?.id ??
    null;
  if (!profile?.birth || !profileId) {
    return { structured: (matrix?.structured as ProfileStructured | undefined) ?? null, rebuilt: false, rebuild_failed: false };
  }
  try {
    const { buildMatrixPayloadFromProfile } = require("@/lib/poju/build-matrix-payload") as typeof import("@/lib/poju/build-matrix-payload");
    const rebuilt = buildMatrixPayloadFromProfile(profileId, profile, {
      locale: session.locked_output_locale ?? "zh",
    });
    return {
      structured: rebuilt.structured,
      rebuilt: true,
      rebuild_failed: !rebuilt.structured?.day_master?.trim(),
    };
  } catch {
    return { structured: null, rebuilt: false, rebuild_failed: true };
  }
}

/**
 * Ensure Session.matrix_payload carries a locally computed ProfileStructured
 * before Understanding / adaptive turns. Uses the authoritative UserProfile
 * when matrix is missing or incomplete — never invents chart data.
 */
export function ensureMatrixPayloadOnSession(
  session: POJUSessionState,
  profile: UserProfile | null,
  locale?: string,
): POJUSessionState {
  if (session.matrix_payload?.structured?.day_master?.trim()) {
    return session;
  }
  const profileId =
    session.selected_stored_profile_id?.trim() ||
    session.agent_v2?.selected_profile_id?.trim() ||
    session.matrix_payload?.profile_id?.trim() ||
    profile?.id?.trim() ||
    null;
  const userProfile = profile ?? session.matrix_payload?.user_profile ?? null;
  if (!profileId || !userProfile?.birth) {
    return session;
  }
  try {
    const { buildMatrixPayloadFromProfile } =
      require("@/lib/poju/build-matrix-payload") as typeof import("@/lib/poju/build-matrix-payload");
    const payload = buildMatrixPayloadFromProfile(profileId, userProfile, {
      locale: locale ?? session.locked_output_locale ?? "zh",
      display_name: session.matrix_payload?.display_name,
    });
    return {
      ...session,
      matrix_payload: payload,
      selected_stored_profile_id:
        session.selected_stored_profile_id?.trim() || profileId,
    };
  } catch {
    return session;
  }
}

/**
 * Build the authority personal-profile payload for one adaptive turn.
 * Prefer matrix_payload.structured; rebuild from local birth calc when needed.
 */
export function buildPersonalProfileContext(
  session: POJUSessionState,
  nowIso: string,
): PersonalProfileContext {
  const bound = bindPersonalAnalysisProfile(session, nowIso);
  const qa = bound.personal_analysis_profile!;
  const matrix = session.matrix_payload;
  const resolved = resolveStructuredFromSession(session);
  const structured = resolved.structured;
  const profileId =
    qa.profile_id ??
    session.selected_stored_profile_id ??
    session.agent_v2?.selected_profile_id ??
    matrix?.profile_id ??
    null;

  let ziweiClosed = qa.ziwei_closed_set ?? null;
  let ziweiStatus = qa.data_availability.ziwei;
  if (!ziweiClosed && matrix?.user_profile?.birth) {
    try {
      const { buildZiweiFactPack } = require("@/lib/ziwei/fact-pack") as typeof import("@/lib/ziwei/fact-pack");
      const { formatZiweiClosedSetForPrompt } = require("@/lib/ziwei/lab-ziwei") as typeof import("@/lib/ziwei/lab-ziwei");
      const block = formatZiweiClosedSetForPrompt(
        buildZiweiFactPack(matrix.user_profile.birth, { asOf: nowIso }),
      );
      ziweiClosed = block.trim() ? block : null;
      ziweiStatus = ziweiClosed ? "available" : "incomplete";
    } catch {
      ziweiStatus = "failed";
    }
  }

  const birthPresent =
    Boolean(matrix?.user_profile?.birth) ||
    Boolean(session.birth_submitted_in_session) ||
    qa.birth_present;

  const baziStatus: PersonalProfileContextAvailability["bazi"] = structured?.day_master?.trim()
    ? "available"
    : birthPresent
      ? "incomplete"
      : "missing";

  const field_coverage = computePersonalProfileFieldCoverage({
    structured,
    ziwei_closed_set: ziweiClosed,
  });

  const personalization_incomplete =
    birthPresent &&
    (baziStatus !== "available" ||
      resolved.rebuild_failed ||
      !field_coverage.four_pillars ||
      !field_coverage.day_master);

  const hash =
    structured != null
      ? computeProfileHash({
          structured,
          ziwei_closed_set: ziweiClosed,
          calculation_schema_version: qa.profile_version,
          calculation_timestamp: qa.calculated_at ?? nowIso,
        })
      : qa.profile_hash;

  return {
    profile_id: profileId,
    profile_hash: hash,
    calculated_at: qa.calculated_at ?? nowIso,
    data_availability: {
      bazi: baziStatus,
      ziwei: ziweiStatus === "failed" ? "failed" : ziweiStatus,
    },
    structured,
    ziwei_closed_set: ziweiClosed,
    field_coverage,
    personalization_incomplete,
    qa_binding: qa,
  };
}

/** Compact JSON for model prompts — full structured fields, no invention. */
export function personalProfileContextForPrompt(ctx: PersonalProfileContext): Record<string, unknown> {
  return {
    profile_id: ctx.profile_id,
    profile_hash: ctx.profile_hash,
    calculated_at: ctx.calculated_at,
    data_availability: ctx.data_availability,
    field_coverage: ctx.field_coverage,
    personalization_incomplete: ctx.personalization_incomplete,
    structured: ctx.structured,
    ziwei_closed_set: ctx.ziwei_closed_set,
  };
}
