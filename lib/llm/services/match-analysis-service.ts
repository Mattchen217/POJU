/**
 * Match v5.1 — local compatibility matrix + DeepSeek report copy.
 */

import {
  buildBaseAnalysisPrompt,
  generateBaseAnalysis,
  parseBaseAnalysisResponseText,
} from "@/lib/llm/deepseek/base-analysis";
import { buildMatchPrompt } from "@/lib/llm/prompts/match-deepseek-prompt";
import { callLLM } from "@/lib/llm/router";
import { calculateCompatibilityMatrix } from "@/lib/match/calculate-compatibility";
import { wrapProfileForMatrix } from "@/lib/match/parse-profile-for-matrix";
import type { CompatibilityLevel, MatchReport } from "@/lib/match/types";
import {
  getStoredProfile,
  recordProfileUsage,
} from "@/lib/profile/stored-profiles-service";
import type { UserProfile } from "@/lib/profile/types";

const REQUIRED_SECTIONS = [
  "analysis_a",
  "analysis_b",
  "combined",
  "conclusion",
  "recommendations",
] as const;

const VALID_COMPATIBILITY_LEVELS = new Set<CompatibilityLevel>([
  "highly_compatible",
  "compatible_with_effort",
  "neutral",
  "challenging",
  "highly_challenging",
]);

const VALID_ACTION_CATEGORIES = new Set([
  "communication",
  "timing",
  "boundary",
  "growth",
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
    compatibility_score: number;
  };
};

type ProfileBundle = {
  user_profile: UserProfile;
  base_analysis: unknown;
};

function parseJsonContent(raw: string): unknown {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/g, "")
    .trim();
  return JSON.parse(cleaned) as unknown;
}

async function generateBaseAnalysisOnServer(profile: UserProfile): Promise<unknown> {
  const { system, user } = buildBaseAnalysisPrompt(profile);
  const result = await callLLM({
    call_type: "match_report",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 10_000,
    thinking_effort: "medium",
    response_format: "json",
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

    if (row.base_analysis?.content == null) {
      console.log(`[match] Generating base_analysis for ${profileId} (client)...`);
      await generateBaseAnalysis(profileId);
      row = await getStoredProfile(profileId);
    }

    if (!row?.user_profile || row.base_analysis?.content == null) {
      throw new Error(
        `Profile has no base_analysis (${profileId}). Complete profile preparation first.`,
      );
    }

    return {
      user_profile: row.user_profile,
      base_analysis: row.base_analysis.content,
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
  computedLevel: CompatibilityLevel,
  compatibilityMatrix: ReturnType<typeof calculateCompatibilityMatrix>,
): MatchReport {
  for (const key of REQUIRED_SECTIONS) {
    if (!parsed[key] || typeof parsed[key] !== "object") {
      throw new Error(`Missing required section: ${key}`);
    }
  }

  const a = parsed.analysis_a as Record<string, unknown>;
  const b = parsed.analysis_b as Record<string, unknown>;
  const combined = parsed.combined as Record<string, unknown>;
  const conclusion = parsed.conclusion as Record<string, unknown>;
  const recommendations = parsed.recommendations as Record<string, unknown>;

  const actionsRaw = recommendations.actions;
  const actions = Array.isArray(actionsRaw)
    ? actionsRaw
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const row = item as Record<string, unknown>;
          const category = asString(row.category);
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
    throw new Error("Match report missing recommendations.actions");
  }

  return {
    analysis_a: {
      title: asString(a.title) || "Person A",
      summary: asString(a.summary),
      detail: asString(a.detail),
      key_traits: asStringArray(a.key_traits),
    },
    analysis_b: {
      title: asString(b.title) || "Person B",
      summary: asString(b.summary),
      detail: asString(b.detail),
      key_traits: asStringArray(b.key_traits),
    },
    combined: {
      title: asString(combined.title) || "Together",
      summary: asString(combined.summary),
      detail: asString(combined.detail),
      five_elements_interaction: asString(combined.five_elements_interaction),
      timing_dynamic: asString(combined.timing_dynamic),
    },
    conclusion: {
      title: asString(conclusion.title) || "Conclusion",
      compatibility_level: computedLevel,
      summary: asString(conclusion.summary),
      detail: asString(conclusion.detail),
      strengths: asStringArray(conclusion.strengths),
      challenges: asStringArray(conclusion.challenges),
    },
    recommendations: {
      title: asString(recommendations.title) || "Recommendations",
      summary: asString(recommendations.summary),
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
        weighted_total_score: compatibilityMatrix.weighted_total_score,
        overall_level: compatibilityMatrix.overall_level,
        day_master_type: compatibilityMatrix.day_master_interaction.type,
        day_branch_he: compatibilityMatrix.branch_interactions.day_branch_he,
        day_branch_chong: compatibilityMatrix.branch_interactions.day_branch_chong,
      },
    },
  };
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
    overall_level: compatibilityMatrix.overall_level,
    score: compatibilityMatrix.weighted_total_score,
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

  const result = await callLLM({
    call_type: "match_report",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 10_000,
    thinking_effort: "medium",
    response_format: "json",
    temperature: 0.55,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonContent(result.content) as Record<string, unknown>;
  } catch (e) {
    console.error("[match] JSON parse failed:", e);
    console.error("[match] Raw (first 800):", result.content.slice(0, 800));
    throw new Error("Match report output is not valid JSON");
  }

  const computedLevel = compatibilityMatrix.overall_level;
  if (
    parsed.conclusion &&
    typeof parsed.conclusion === "object" &&
    (parsed.conclusion as Record<string, unknown>).compatibility_level !== computedLevel
  ) {
    console.warn(
      "[match] LLM compatibility_level overridden:",
      (parsed.conclusion as Record<string, unknown>).compatibility_level,
      "→",
      computedLevel,
    );
  }
  if (parsed.conclusion && typeof parsed.conclusion === "object") {
    (parsed.conclusion as Record<string, unknown>).compatibility_level = computedLevel;
  }

  const report = validateAndNormalizeReport(
    parsed,
    {
      ...input,
      relationship_description: input.relationship_description.trim(),
    },
    detected_language,
    result.actual_model,
    result.meta.tokens_used,
    computedLevel,
    compatibilityMatrix,
  );

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
      compatibility_score: compatibilityMatrix.weighted_total_score,
    },
  };
}
