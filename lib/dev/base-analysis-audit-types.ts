import type { UserProfile } from "@/lib/profile/types";

export type BaseAnalysisAuditRecord = {
  id: string;
  created_at: string;
  stored_profile_id: string | null;
  display_name: string | null;
  birth_summary: string;
  user_profile: UserProfile;
  prompts: { system: string; user: string };
  analysis: unknown;
  model: string;
  tokens_used: number;
  latency_ms?: number;
  cost_usd?: number;
  reasoning?: string;
  raw_model_text?: string;
};

export type BaseAnalysisAuditListItem = {
  id: string;
  created_at: string;
  stored_profile_id: string | null;
  display_name: string | null;
  birth_summary: string;
  four_pillars: string;
  day_master: string;
  model: string;
  tokens_used: number;
};
