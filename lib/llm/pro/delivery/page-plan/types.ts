import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

/** Which spine/core fields a page must consume (pointers, not prose). */
export type PageMustUseField =
  | "situation_conclusion"
  | "key_crossroads"
  | "primary_path"
  | "backup_path"
  | "action_plan"
  | "energy_structure"
  | "multi_dim_all"
  | "multi_dim_filtered"
  | "multi_dim_risk"
  | "modern_action_frames"
  | "energy_retune_frame"
  | "metaphysics_pack_full"
  | "metaphysics_pack_polarity"
  | "metaphysics_pack_dashboard"
  | "rhythm_frame"
  | "self_check_negative"
  | "self_check_positive"
  | "question_expectation"
  | "action_brief";

export type DeliveryPagePlanEntry = {
  key: DeliverySegmentKey;
  goal: string;
  must_use: readonly PageMustUseField[];
  forbid: readonly string[];
  /** multi_dim indices (0-based) when filtered/risk subset applies */
  multi_dim_indices?: readonly number[];
};

export type DeliveryPagePlan = {
  version: "delivery_page_plan_v1";
  pages: Record<DeliverySegmentKey, DeliveryPagePlanEntry>;
};
