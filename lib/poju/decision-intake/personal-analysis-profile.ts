/**
 * Q&A-phase Personal Analysis Profile.
 * Bound once at session init from already-available chart data.
 * Does not recompute BaZi/ZiWei every turn and is not a RealityFacts store.
 */

import { sanitizePlainExport } from "@/lib/glossary/sanitize-export-surface";
import { computeProfileHash } from "@/lib/poju/decision-intake/personal-analysis";
import type { POJUSessionState } from "@/lib/poju/types";
import type { PersonalPatternInsightBlock } from "./types";

export const QA_PERSONAL_PROFILE_VERSION = "poju-qa-profile-v1";

export type PersonalAnalysisAvailability = "available" | "missing" | "incomplete" | "failed";

export type PersonalAnalysisDataAvailability = {
  bazi: PersonalAnalysisAvailability;
  ziwei: PersonalAnalysisAvailability;
};

export type PersonalAnalysisProfile = {
  profile_id: string | null;
  profile_version: string;
  profile_hash: string | null;
  source: "matrix_payload" | "unavailable";
  calculated_at: string | null;
  bazi_engine: "shunshi-bazi-core" | null;
  ziwei_engine: "iztro" | null;
  data_availability: PersonalAnalysisDataAvailability;
  birth_present: boolean;
  bazi_day_master?: string | null;
  bazi_strength?: string | null;
  bazi_pattern?: string | null;
  ziwei_closed_set?: string | null;
};

const DECISION_RELEVANCE_RE =
  /工作|职业|创业|离职|跳槽|事业|资金|预算|收入|风险|关系|婚姻|家庭|合作|去留|offer|career|job|business|resign|money|budget|risk|relationship|family|partner/i;

function unavailable(profileId: string | null, nowIso: string): PersonalAnalysisProfile {
  return {
    profile_id: profileId,
    profile_version: QA_PERSONAL_PROFILE_VERSION,
    profile_hash: null,
    source: "unavailable",
    calculated_at: nowIso,
    bazi_engine: null,
    ziwei_engine: null,
    data_availability: { bazi: "missing", ziwei: "missing" },
    birth_present: false,
  };
}

export function bindPersonalAnalysisProfile(
  session: POJUSessionState,
  nowIso: string,
): POJUSessionState {
  const existing = session.personal_analysis_profile;
  if (existing && existing.source !== "unavailable") return session;

  const matrix = session.matrix_payload;
  const structured = matrix?.structured;
  const profileId =
    session.selected_stored_profile_id ??
    session.agent_v2?.selected_profile_id ??
    matrix?.profile_id ??
    null;
  const birth = matrix?.user_profile?.birth ?? null;
  const birthPresent = Boolean(birth) || Boolean(session.birth_submitted_in_session);
  const baziAvailable = Boolean(structured?.day_master?.trim());

  if (!baziAvailable && !birthPresent) {
    return { ...session, personal_analysis_profile: unavailable(profileId, nowIso) };
  }

  let ziweiClosed: string | null = null;
  let ziweiStatus: PersonalAnalysisAvailability = birthPresent ? "missing" : "missing";
  if (birth) {
    try {
      // Lazy import keeps this module from loading iztro until a profile is actually bound.
      const { buildZiweiFactPack } = require("@/lib/ziwei/fact-pack") as typeof import("@/lib/ziwei/fact-pack");
      const { formatZiweiClosedSetForPrompt } = require("@/lib/ziwei/lab-ziwei") as typeof import("@/lib/ziwei/lab-ziwei");
      const block = formatZiweiClosedSetForPrompt(buildZiweiFactPack(birth, { asOf: nowIso }));
      ziweiClosed = block.trim() ? block : null;
      ziweiStatus = ziweiClosed ? "available" : "incomplete";
    } catch {
      ziweiStatus = "failed";
    }
  }

  const baziStatus: PersonalAnalysisAvailability = baziAvailable
    ? "available"
    : birthPresent
      ? "incomplete"
      : "missing";

  const profile: PersonalAnalysisProfile = {
    profile_id: profileId,
    profile_version: QA_PERSONAL_PROFILE_VERSION,
    profile_hash: structured
      ? computeProfileHash({
          structured,
          ziwei_closed_set: ziweiClosed,
          calculation_schema_version: QA_PERSONAL_PROFILE_VERSION,
          calculation_timestamp: nowIso,
        })
      : null,
    source: structured ? "matrix_payload" : "unavailable",
    calculated_at: nowIso,
    bazi_engine: baziAvailable ? "shunshi-bazi-core" : null,
    ziwei_engine: ziweiClosed ? "iztro" : null,
    data_availability: { bazi: baziStatus, ziwei: ziweiStatus },
    birth_present: birthPresent,
    bazi_day_master: structured?.day_master ?? null,
    bazi_strength: structured?.strength ?? null,
    bazi_pattern: structured?.pattern ?? null,
    ziwei_closed_set: ziweiClosed,
  };

  return { ...session, personal_analysis_profile: profile };
}

function insightFingerprint(block: PersonalPatternInsightBlock): string {
  return `${block.status}::${block.reason ?? ""}::${block.insights.map((i) => `${i.source}:${i.text}`).join("|")}`;
}

export function evaluateQaPersonalPatternInsight(
  session: POJUSessionState,
  locale = "zh",
): PersonalPatternInsightBlock {
  const profile = session.personal_analysis_profile;
  if (!profile || profile.source === "unavailable") {
    const baziMissing = !profile || profile.data_availability.bazi !== "available";
    const ziweiMissing = !profile || profile.data_availability.ziwei !== "available";
    if (baziMissing && ziweiMissing) {
      return { status: "unavailable", reason: "personal_analysis_profile_unavailable", insights: [] };
    }
  }
  const available =
    profile?.data_availability.bazi === "available" ||
    profile?.data_availability.ziwei === "available";
  if (!profile || !available) {
    return { status: "unavailable", reason: "personal_analysis_profile_incomplete", insights: [] };
  }

  const dq =
    session.decision_context?.definition?.decision_question ??
    session.original_question ??
    "";
  if (!DECISION_RELEVANCE_RE.test(dq)) {
    return { status: "none", reason: "no_decision_relevant_insight", insights: [] };
  }

  const related = (session.decision_blueprint?.directions ?? [])
    .filter((d) => d.priority === "P0" || d.priority === "P1")
    .map((d) => d.direction_id)
    .slice(0, 3);

  const rawParts = [
    profile.bazi_day_master ? `日主 ${profile.bazi_day_master}` : null,
    profile.bazi_strength ? `强弱 ${profile.bazi_strength}` : null,
    profile.bazi_pattern ? `格局 ${profile.bazi_pattern}` : null,
    profile.data_availability.ziwei === "available" ? "紫微斗数本地数据已纳入参考" : null,
  ].filter(Boolean);
  if (!rawParts.length) {
    return { status: "none", reason: "no_decision_relevant_insight", insights: [] };
  }

  const raw =
    `传统分析提示（不是已验证的现实事实，也不是确认的 RealityFact）：${rawParts.join("、")}` +
    `。它只在与当前决策相关时作为待验证假设，需要用现实行为加以核对。`;
  const text = sanitizePlainExport(raw, locale, "copy").content.trim();
  const block: PersonalPatternInsightBlock = {
    status: "available",
    reason: "qa_profile_decision_relevant",
    insights: [
      {
        text,
        source: `qa_profile:${profile.profile_version}:${profile.profile_hash ?? "none"}`,
        related_dir_ids: related,
        profile_version: profile.profile_version,
        epistemic: "traditional_interpretation",
      },
    ],
  };

  const prev = session.decision_understanding?.personal_pattern_insight;
  if (prev && insightFingerprint(prev) === insightFingerprint(block)) {
    return { status: "none", reason: "no_new_personal_pattern_insight", insights: [] };
  }
  return block;
}
