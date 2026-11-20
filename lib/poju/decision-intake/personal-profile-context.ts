/**
 * Full personal-profile context for DI2 Personalized Understanding turns.
 * Authority: local ProfileStructured + Ziwei fact pack — model must not invent chart data.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { computeProfileHash } from "@/lib/poju/decision-intake/personal-analysis";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  bindPersonalAnalysisProfile,
  type PersonalAnalysisProfile,
} from "./personal-analysis-profile";

export type PersonalProfileContextAvailability = {
  bazi: "available" | "missing" | "incomplete";
  ziwei: "available" | "missing" | "incomplete" | "failed";
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
  /** Thin QA binding kept for legacy consumers. */
  qa_binding: PersonalAnalysisProfile;
};

/**
 * Build the authority personal-profile payload for one adaptive turn.
 * Prefer matrix_payload.structured (already bound to the session profile).
 */
export function buildPersonalProfileContext(
  session: POJUSessionState,
  nowIso: string,
): PersonalProfileContext {
  const bound = bindPersonalAnalysisProfile(session, nowIso);
  const qa = bound.personal_analysis_profile!;
  const matrix = session.matrix_payload;
  const structured = (matrix?.structured as ProfileStructured | undefined) ?? null;
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

  const baziStatus: PersonalProfileContextAvailability["bazi"] = structured?.day_master?.trim()
    ? "available"
    : qa.birth_present
      ? "incomplete"
      : "missing";

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
    structured: ctx.structured,
    ziwei_closed_set: ctx.ziwei_closed_set,
  };
}
