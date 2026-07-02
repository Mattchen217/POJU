/**
 * Match v5.1 — local compatibility matrix + DeepSeek report copy.
 */

import {
  baseAnalysisCacheSessionId,
  matchCacheSessionId,
} from "@/lib/llm/cache-session-id";
import {
  buildBaseAnalysisPrompt,
  generateBaseAnalysis,
  parseBaseAnalysisResponseText,
} from "@/lib/llm/deepseek/base-analysis";
import {
  hasBaseAnalysisPayload,
  normalizeBaseAnalysisInput,
} from "@/lib/llm/prompts/base-analysis-context";
import { buildMatchPrompt } from "@/lib/llm/prompts/match-deepseek-prompt";
import { buildMatchRelationClosedSet } from "@/lib/llm/prompts/relation-closed-set-context";
import { callLLM } from "@/lib/llm/router";
import {
  requestJsonWithRepair,
  type JsonValidateResult,
} from "@/lib/llm/services/delivery-resilience";
import {
  auditDeepStringFields,
  buildAuditRegenHint,
  isCriticalDeliveryAuditFailure,
} from "@/lib/llm/services/delivery-audit-regen";
import { sanitizeDeepStringFields } from "@/lib/llm/sanitize/compliance-terms";
import { polishDeepStringFields } from "@/lib/llm/sanitize/delivery-grammar-polish";
import { calculateCompatibilityMatrix } from "@/lib/match/calculate-compatibility";
import { normalizeSynergyType } from "@/lib/match/synergy-normalize";
import { wrapProfileForMatrix } from "@/lib/match/parse-profile-for-matrix";
import type { MatchReport, SynergyType } from "@/lib/match/types";
import {
  getStoredProfile,
  recordProfileUsage,
} from "@/lib/profile/stored-profiles-service";
import type { UserProfile } from "@/lib/profile/types";

const VALID_ACTION_CATEGORIES = new Set([
  "communication",
  "timing",
  "boundary",
  "growth",
  "environment",
  /** @deprecated LLM may still emit; normalized to environment */
  "fengshui",
]);

export type GenerateMatchAnalysisInput = {
  a_profile_id: string;
  b_profile_id: string;
  relationship_description: string;
  locale: string;
  a_user_profile?: UserProfile | null;
  a_base_analysis?: unknown | null;
  b_user_profile?: UserProfile | null;
  b_base_analysis?: unknown | null;
  /** Optional session key for observability; supplier pin = OPENROUTER_PROVIDER_ORDER. */
  cache_session_id?: string;
};

export type MatchAnalysisServiceResult = {
  report: MatchReport;
  meta: {
    model: string;
    tokens_used: number;
    cost_usd: number;
    latency_ms: number;
    detected_language: string;
    local_computation: boolean;
    resonance_index: number;
  };
};

type ProfileBundle = {
  user_profile: UserProfile;
  base_analysis: unknown;
};

async function generateBaseAnalysisOnServer(profile: UserProfile): Promise<unknown> {
  const { system, user } = buildBaseAnalysisPrompt(profile);
  const result = await callLLM({
    call_type: "match_report",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 10_000,
    thinking_effort: "medium",
    response_format: "json",
    session_id: baseAnalysisCacheSessionId(profile.id),
  });
  return parseBaseAnalysisResponseText(result.content);
}

async function ensureBaseAnalysis(
  profileId: string,
  user_profile: UserProfile | null | undefined,
  base_analysis: unknown | null | undefined,
): Promise<ProfileBundle> {
  if (user_profile && base_analysis != null) {
    return { user_profile, base_analysis };
  }

  if (typeof window !== "undefined") {
    let row = await getStoredProfile(profileId);
    if (!row?.user_profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    if (!hasBaseAnalysisPayload(normalizeBaseAnalysisInput(row.base_analysis))) {
      console.log(`[match] Generating base_analysis for ${profileId} (client)...`);
      await generateBaseAnalysis(profileId);
      row = await getStoredProfile(profileId);
    }

    if (!row?.user_profile || !hasBaseAnalysisPayload(normalizeBaseAnalysisInput(row.base_analysis))) {
      throw new Error(
        `Profile has no base_analysis (${profileId}). Complete profile preparation first.`,
      );
    }

    return {
      user_profile: row.user_profile,
      base_analysis: row.base_analysis,
    };
  }

  if (!user_profile) {
    throw new Error(
      `Profile payload missing for ${profileId}. Send user_profile + base_analysis from the client.`,
    );
  }

  if (base_analysis == null) {
    console.log(`[match] Generating base_analysis for ${profileId} (server)...`);
    const generated = await generateBaseAnalysisOnServer(user_profile);
    return { user_profile, base_analysis: generated };
  }

  return { user_profile, base_analysis };
}


function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => asString(x)).filter(Boolean).slice(0, 8);
}

function validateAndNormalizeReport(
  parsed: Record<string, unknown>,
  input: GenerateMatchAnalysisInput,
  detected_language: string,
  model: string,
  tokens_used: number,
  computedSynergyType: SynergyType,
  compatibilityMatrix: ReturnType<typeof calculateCompatibilityMatrix>,
  locale: string,
): JsonValidateResult<MatchReport> {
  const combined =
    parsed.combined && typeof parsed.combined === "object"
      ? (parsed.combined as Record<string, unknown>)
      : null;
  const conclusion =
    parsed.conclusion && typeof parsed.conclusion === "object"
      ? (parsed.conclusion as Record<string, unknown>)
      : null;

  const missingCore: string[] = [];
  if (!combined) missingCore.push("combined");
  if (!conclusion) missingCore.push("conclusion");
  if (missingCore.length > 0) {
    return {
      ok: false,
      missing: missingCore,
      message: `Match report missing core sections: ${missingCore.join(", ")}`,
      parsed,
    };
  }

  const a =
    parsed.analysis_a && typeof parsed.analysis_a === "object"
      ? (parsed.analysis_a as Record<string, unknown>)
      : {};
  const b =
    parsed.analysis_b && typeof parsed.analysis_b === "object"
      ? (parsed.analysis_b as Record<string, unknown>)
      : {};
  const recommendations =
    parsed.recommendations && typeof parsed.recommendations === "object"
      ? (parsed.recommendations as Record<string, unknown>)
      : {};

  if (!parsed.analysis_a || typeof parsed.analysis_a !== "object") {
    console.warn("[match] soft fallback: analysis_a");
  }
  if (!parsed.analysis_b || typeof parsed.analysis_b !== "object") {
    console.warn("[match] soft fallback: analysis_b");
  }
  if (!parsed.recommendations || typeof parsed.recommendations !== "object") {
    console.warn("[match] soft fallback: recommendations");
  }

  const actionsRaw = recommendations.actions;
  let actions = Array.isArray(actionsRaw)
    ? actionsRaw
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const row = item as Record<string, unknown>;
          let category = asString(row.category);
          if (category === "fengshui") category = "environment";
          return {
            category: (VALID_ACTION_CATEGORIES.has(category)
              ? category
              : "communication") as MatchReport["recommendations"]["actions"][0]["category"],
            title: asString(row.title),
            detail: asString(row.detail),
            timing: asString(row.timing) || undefined,
          };
        })
        .filter((act) => act.title && act.detail)
    : [];

  if (actions.length < 1) {
    const insight =
      compatibilityMatrix.key_insights.strengths[0] ||
      compatibilityMatrix.key_insights.challenges[0] ||
      (locale.startsWith("zh")
        ? "先就你们最在意的一件事开诚布公地谈一次。"
        : "Start with one honest conversation about what matters most between you.");
    console.warn("[match] soft fallback: recommendations.actions");
    actions = [
      {
        category: "communication",
        title: locale.startsWith("zh") ? "从最关键的一点开始" : "Start with the key point",
        detail: insight,
        timing: undefined,
      },
    ];
  }

  const soft = (v: string, fallback: string) => (v.trim() ? v : fallback);

  const report: MatchReport = {
    analysis_a: {
      title: asString(a.title) || "Person A",
      summary: soft(asString(a.summary), locale.startsWith("zh") ? "见上文合盘分析。" : "See combined analysis above."),
      detail: soft(asString(a.detail), locale.startsWith("zh") ? "个体脉络已融入合盘段落。" : "Individual thread woven into combined sections."),
      key_traits: asStringArray(a.key_traits),
    },
    analysis_b: {
      title: asString(b.title) || "Person B",
      summary: soft(asString(b.summary), locale.startsWith("zh") ? "见上文合盘分析。" : "See combined analysis above."),
      detail: soft(asString(b.detail), locale.startsWith("zh") ? "个体脉络已融入合盘段落。" : "Individual thread woven into combined sections."),
      key_traits: asStringArray(b.key_traits),
    },
    combined: {
      title: asString(combined!.title) || "Together",
      summary: soft(asString(combined!.summary), locale.startsWith("zh") ? "两人互动见细节段。" : "See detail for interaction pattern."),
      detail: soft(asString(combined!.detail), locale.startsWith("zh") ? "合盘细节已在上文展开。" : "Combined dynamics expanded above."),
      five_elements_interaction: soft(
        asString(combined!.five_elements_interaction),
        locale.startsWith("zh") ? "五行互动见本地矩阵。" : "See local matrix for element interaction.",
      ),
      timing_dynamic: soft(
        asString(combined!.timing_dynamic),
        locale.startsWith("zh") ? "时运节奏见结论段。" : "See conclusion for timing rhythm.",
      ),
    },
    conclusion: {
      title: asString(conclusion!.title) || "Conclusion",
      question_response:
        asString(conclusion!.question_response) || asString(conclusion!.summary) || undefined,
      synergy_type: computedSynergyType,
      summary: soft(asString(conclusion!.summary), locale.startsWith("zh") ? "见细节段。" : "See detail section."),
      detail: soft(asString(conclusion!.detail), locale.startsWith("zh") ? "结论已融入合盘分析。" : "Conclusion woven into combined analysis."),
      strengths: asStringArray(conclusion!.strengths).length
        ? asStringArray(conclusion!.strengths)
        : compatibilityMatrix.key_insights.strengths.slice(0, 3),
      challenges: asStringArray(conclusion!.challenges).length
        ? asStringArray(conclusion!.challenges)
        : compatibilityMatrix.key_insights.challenges.slice(0, 3),
    },
    recommendations: {
      title: asString(recommendations.title) || "Recommendations",
      summary: soft(asString(recommendations.summary), locale.startsWith("zh") ? "见下方行动建议。" : "See actions below."),
      actions,
    },
    _meta: {
      a_profile_id: input.a_profile_id,
      b_profile_id: input.b_profile_id,
      relationship_description: input.relationship_description,
      detected_language,
      generated_at: new Date().toISOString(),
      model,
      tokens_used,
      computation_meta: {
        resonance_index: compatibilityMatrix.resonance_index,
        synergy_type: compatibilityMatrix.synergy_type,
        day_master_type: compatibilityMatrix.day_master_interaction.type,
        day_branch_he: compatibilityMatrix.branch_interactions.day_branch_he,
        day_branch_chong: compatibilityMatrix.branch_interactions.day_branch_chong,
      },
    },
  };

  return { ok: true, value: report };
}

export async function generateMatchAnalysis(
  input: GenerateMatchAnalysisInput,
): Promise<MatchAnalysisServiceResult> {
  if (!input.a_profile_id?.trim() || !input.b_profile_id?.trim()) {
    throw new Error("a_profile_id and b_profile_id are required");
  }
  if (input.a_profile_id === input.b_profile_id) {
    throw new Error("Person A and Person B must be different profiles");
  }
  if (!input.relationship_description?.trim()) {
    throw new Error("relationship_description is required");
  }

  const [aBundle, bBundle] = await Promise.all([
    ensureBaseAnalysis(
      input.a_profile_id,
      input.a_user_profile,
      input.a_base_analysis,
    ),
    ensureBaseAnalysis(
      input.b_profile_id,
      input.b_user_profile,
      input.b_base_analysis,
    ),
  ]);

  console.log("[match] Computing compatibility matrix locally...");
  const computeStart = Date.now();
  const compatibilityMatrix = calculateCompatibilityMatrix({
    profileA: wrapProfileForMatrix(aBundle.user_profile, aBundle.base_analysis),
    profileB: wrapProfileForMatrix(bBundle.user_profile, bBundle.base_analysis),
  });
  const computeMs = Date.now() - computeStart;

  console.log("[match] Computed:", {
    synergy_type: compatibilityMatrix.synergy_type,
    resonance_index: compatibilityMatrix.resonance_index,
    strengths: compatibilityMatrix.key_insights.strengths.length,
    challenges: compatibilityMatrix.key_insights.challenges.length,
    compute_ms: computeMs,
  });

  const { system, user, detected_language } = buildMatchPrompt({
    a_profile: aBundle.user_profile,
    a_base_analysis: aBundle.base_analysis,
    b_profile: bBundle.user_profile,
    b_base_analysis: bBundle.base_analysis,
    relationship_description: input.relationship_description.trim(),
    locale: input.locale,
    compatibilityMatrix,
  });

  console.log(`[match] Calling DeepSeek for report (language: ${detected_language})`);
  const startTime = Date.now();

  const cacheSessionId =
    input.cache_session_id?.trim() ||
    matchCacheSessionId(input.a_profile_id, input.b_profile_id);

  const computedSynergyType = compatibilityMatrix.synergy_type;
  const trimmedInput = {
    ...input,
    relationship_description: input.relationship_description.trim(),
  };

  const structuredA = normalizeBaseAnalysisInput(aBundle.base_analysis).structured ?? null;
  const structuredB = normalizeBaseAnalysisInput(bBundle.base_analysis).structured ?? null;
  const relationAudit =
    structuredA && structuredB
      ? buildMatchRelationClosedSet(structuredA, structuredB, trimmedInput.relationship_description)
      : null;

  let userContent = user;
  let auditRetried = false;
  let reportRaw!: MatchReport;
  let result!: Awaited<ReturnType<typeof requestJsonWithRepair<MatchReport>>>["result"];

  for (;;) {
    const out = await requestJsonWithRepair({
      llm: {
        call_type: "match_report",
        system,
        messages: [{ role: "user", content: userContent }],
        max_tokens: 10_000,
        thinking_effort: "medium",
        response_format: "json",
        temperature: auditRetried ? 0.3 : 0.55,
        session_id: cacheSessionId,
      },
      validate: (parsed) => {
        if (parsed.conclusion && typeof parsed.conclusion === "object") {
          const conclusion = parsed.conclusion as Record<string, unknown>;
          const llmType = normalizeSynergyType(conclusion.synergy_type ?? conclusion.compatibility_level);
          if (llmType !== computedSynergyType) {
            console.warn(
              "[match] LLM synergy_type overridden:",
              conclusion.synergy_type ?? conclusion.compatibility_level,
              "→",
              computedSynergyType,
            );
          }
          conclusion.synergy_type = computedSynergyType;
        }
        return validateAndNormalizeReport(
          parsed,
          trimmedInput,
          detected_language,
          "pending",
          0,
          computedSynergyType,
          compatibilityMatrix,
          input.locale,
        );
      },
      repairHint: (missing) =>
        input.locale.startsWith("zh")
          ? `上次回复缺失或被截断。请补全以下 section/字段并返回完整 JSON：${missing.join(", ")}`
          : `Previous reply was missing or truncated. Fill these sections/fields and return complete JSON: ${missing.join(", ")}`,
    });
    reportRaw = out.value;
    result = out.result;

    const auditViolations = auditDeepStringFields(reportRaw, input.locale, "match", {
      structured: structuredA,
      relations: relationAudit?.auditAllowlist,
    });
    if (isCriticalDeliveryAuditFailure(auditViolations) && !auditRetried) {
      auditRetried = true;
      console.warn("[match] audit regen (1x)", auditViolations.slice(0, 5));
      userContent = user + buildAuditRegenHint(auditViolations, input.locale);
      continue;
    }
    break;
  }

  let report = reportRaw;
  report = sanitizeDeepStringFields(report, input.locale) as MatchReport;
  report = polishDeepStringFields(report, input.locale) as MatchReport;
  report._meta = {
    ...report._meta!,
    model: result.actual_model,
    tokens_used: result.meta.tokens_used,
  };

  if (typeof window !== "undefined") {
    await Promise.all([
      recordProfileUsage(input.a_profile_id, "match"),
      recordProfileUsage(input.b_profile_id, "match"),
    ]);
  }

  const elapsedMs = Date.now() - startTime;
  console.log(`[match] Done in ${elapsedMs}ms (local compute ${computeMs}ms)`);

  return {
    report,
    meta: {
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      cost_usd: result.meta.cost_usd,
      latency_ms: elapsedMs,
      detected_language,
      local_computation: true,
      resonance_index: compatibilityMatrix.resonance_index,
    },
  };
}
