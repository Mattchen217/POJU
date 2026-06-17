/**
 * Match v5 — report + session types (synergy / resonance naming for product surface).
 */

export type MatchSection =
  | "analysis_a"
  | "analysis_b"
  | "combined"
  | "conclusion"
  | "recommendations";

export type SynergyType =
  | "full_resonance"
  | "complementary_flow"
  | "adaptive_balance"
  | "dynamic_tension"
  | "structural_undertow";

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
    synergy_type: SynergyType;
    summary: string;
    detail: string;
    strengths: string[];
    challenges: string[];
  };

  recommendations: {
    title: string;
    summary: string;
    actions: Array<{
      category: "communication" | "timing" | "boundary" | "growth" | "environment";
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
    computation_meta?: {
      resonance_index: number;
      synergy_type: SynergyType;
      day_master_type: string;
      day_branch_he: boolean;
      day_branch_chong: boolean;
    };
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
  resonance_index?: number;
  engine_version?: "v5.1";
  /** Hook flow — set on preview session before analyze. */
  unlock_status?: "preview" | "unlocked";
  unlock_via?: "payment" | "code";
  pending_question?: string;
}

/** JSON-serializable session blob (encrypted at rest). */
export type MatchSessionPayload = Omit<MatchSession, "created_at"> & {
  created_at: string;
};

export interface SynergyTypeInfo {
  type: SynergyType;
  name_en: string;
  name_zh: string;
  color_hex: string;
  signal_segments: number;
}

export const SYNERGY_TYPES: Record<SynergyType, SynergyTypeInfo> = {
  full_resonance: {
    type: "full_resonance",
    name_en: "Full Resonance",
    name_zh: "完全共鸣",
    color_hex: "#0D7377",
    signal_segments: 5,
  },
  complementary_flow: {
    type: "complementary_flow",
    name_en: "Complementary Flow",
    name_zh: "互补流动",
    color_hex: "#26A69A",
    signal_segments: 4,
  },
  adaptive_balance: {
    type: "adaptive_balance",
    name_en: "Adaptive Balance",
    name_zh: "适应性平衡",
    color_hex: "#90A4AE",
    signal_segments: 3,
  },
  dynamic_tension: {
    type: "dynamic_tension",
    name_en: "Dynamic Tension",
    name_zh: "动态张力",
    color_hex: "#F57C00",
    signal_segments: 2,
  },
  structural_undertow: {
    type: "structural_undertow",
    name_en: "Structural Undertow",
    name_zh: "结构性险滞",
    color_hex: "#C62828",
    signal_segments: 1,
  },
};
