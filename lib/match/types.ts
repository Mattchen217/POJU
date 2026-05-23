/**
 * Match v5 — report + session types.
 * @see docs/Match_v5.0_New.md Step 1
 */

export type MatchSection =
  | "analysis_a"
  | "analysis_b"
  | "combined"
  | "conclusion"
  | "recommendations";

export type CompatibilityLevel =
  | "highly_compatible"
  | "compatible_with_effort"
  | "neutral"
  | "challenging"
  | "highly_challenging";

export interface MatchReport {
  analysis_a: {
    title: string;
    summary: string;
    detail: string;
    key_traits: string[];
  };

  analysis_b: {
    title: string;
    summary: string;
    detail: string;
    key_traits: string[];
  };

  combined: {
    title: string;
    summary: string;
    detail: string;
    five_elements_interaction: string;
    timing_dynamic: string;
  };

  conclusion: {
    title: string;
    compatibility_level: CompatibilityLevel;
    summary: string;
    detail: string;
    strengths: string[];
    challenges: string[];
  };

  recommendations: {
    title: string;
    summary: string;
    actions: Array<{
      category: "communication" | "timing" | "boundary" | "growth" | "fengshui";
      title: string;
      detail: string;
      timing?: string;
    }>;
  };

  _meta: {
    a_profile_id: string;
    b_profile_id: string;
    relationship_description: string;
    detected_language: string;
    generated_at: string;
    model: string;
    tokens_used: number;
  };
}

export interface MatchSession {
  match_id: string;
  device_id: string;
  a_profile_id: string;
  b_profile_id: string;
  relationship_description: string;
  report: MatchReport;
  created_at: Date;
  is_free: boolean;
  cost_usd: number;
  locale: string;
}

/** JSON-serializable session blob (encrypted at rest). */
export type MatchSessionPayload = Omit<MatchSession, "created_at"> & {
  created_at: string;
};

export interface CompatibilityLevelInfo {
  level: CompatibilityLevel;
  name_en: string;
  name_zh: string;
  color_hex: string;
  score: number;
}

export const COMPATIBILITY_LEVELS: Record<CompatibilityLevel, CompatibilityLevelInfo> = {
  highly_compatible: {
    level: "highly_compatible",
    name_en: "Highly Compatible",
    name_zh: "高度契合",
    color_hex: "#0D7377",
    score: 5,
  },
  compatible_with_effort: {
    level: "compatible_with_effort",
    name_en: "Compatible with Effort",
    name_zh: "相辅相成",
    color_hex: "#26A69A",
    score: 4,
  },
  neutral: {
    level: "neutral",
    name_en: "Neutral",
    name_zh: "中和并存",
    color_hex: "#90A4AE",
    score: 3,
  },
  challenging: {
    level: "challenging",
    name_en: "Challenging",
    name_zh: "相互磨合",
    color_hex: "#F57C00",
    score: 2,
  },
  highly_challenging: {
    level: "highly_challenging",
    name_en: "Highly Challenging",
    name_zh: "困难重重",
    color_hex: "#C62828",
    score: 1,
  },
};
