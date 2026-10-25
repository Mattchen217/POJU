/**
 * Minimal shapes for quarantined Glyph / Match / Syncro archive rows.
 * The product modules live under legacy/ and are not part of the Eastern OS build.
 */

export type GlyphReadingContent = {
  wind_category_blurb?: string;
  classical_voice?: string;
  question_response?: string;
  synthesis?: string;
  meaning_for_question?: string;
  hidden_tension?: string;
  your_moment?: string;
  exploration?: {
    text?: string;
    timeframe?: string;
    duration_estimate?: string;
    is_solo?: boolean;
  };
  reflection_question?: string;
  invalid_input?: boolean;
  _meta?: Record<string, unknown>;
};

export type SyncroMatrixCell = {
  current_level: string;
  short_advice: string;
};

export type SyncroMatrix = Record<string, SyncroMatrixCell>;

export type MatchReport = {
  conclusion: {
    synergy_type?: string;
    summary?: string;
    title?: string;
    detail?: string;
    strengths: string[];
    challenges: string[];
  };
  analysis_a: { title?: string; summary?: string; detail?: string };
  analysis_b: { title?: string; summary?: string; detail?: string };
  combined: {
    title?: string;
    summary?: string;
    detail?: string;
    five_elements_interaction?: string;
  };
  recommendations: {
    title?: string;
    summary?: string;
    actions: Array<{ title?: string; detail?: string }>;
  };
  _meta: {
    relationship_description?: string;
  };
};

export type MatchSession = {
  match_id: string;
  a_profile_id: string;
  b_profile_id: string;
  relationship_description?: string;
  resonance_index?: number;
  report: MatchReport;
};

export type SyncroSession = {
  session_id: string;
  task_description?: string;
  locale?: string;
  is_free?: boolean;
  user_location?: unknown;
  matrix?: SyncroMatrix;
};

const CURRENT_LEVEL_SCORES: Record<string, number> = {
  open_current: 5,
  following_current: 4,
  stillwater: 3,
  crosscurrent: 2,
  undertow: 1,
};

export function scoreForCurrentLevel(level: string): number {
  return CURRENT_LEVEL_SCORES[level] ?? 0;
}

const SYNERGY_TYPES = new Set([
  "full_resonance",
  "complementary_flow",
  "adaptive_balance",
  "dynamic_tension",
  "structural_undertow",
]);

const LEGACY_SYNERGY_TYPE_MAP: Record<string, string> = {
  highly_compatible: "full_resonance",
  compatible_with_effort: "complementary_flow",
  neutral: "adaptive_balance",
  challenging: "dynamic_tension",
  highly_challenging: "structural_undertow",
};

export function normalizeMatchArchiveSynergyType(raw: unknown): string {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (key && SYNERGY_TYPES.has(key)) return key;
  if (key && key in LEGACY_SYNERGY_TYPE_MAP) return LEGACY_SYNERGY_TYPE_MAP[key]!;
  return "adaptive_balance";
}
