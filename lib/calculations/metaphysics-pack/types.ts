import type {
  Direction8,
  DirectionRatingLevel,
  DirectionsOutput,
  FiveElement,
  YongShenOutput,
} from "@/lib/calculations/types";

import type {
  DashboardCapacities,
  ElementCareerDirection,
  ElementColorAnchor,
  ElementScoreMap,
  FavorableHourSlot,
} from "./element-adaptations";
import type { NobleDirectionResult } from "./noble-direction";

/** Delivery-facing adaptation labels (适配 — not 吉凶). */
export type DirectionFitLevel =
  | "high_fit"
  | "supportive"
  | "neutral"
  | "friction"
  | "drain";

export type DirectionFitCell = {
  direction: Direction8;
  base_element: FiveElement;
  combined_score: number;
  /** Raw M6 rating kept for debug / Syncro parity */
  m6_rating: DirectionRatingLevel;
  /** Compliance-friendly remapped level */
  fit: DirectionFitLevel;
  brief_note: string;
};

export type MetaphysicsDirectionsPack = {
  yong_shen: YongShenOutput;
  current_hour: DirectionsOutput["current_hour"];
  validity: DirectionsOutput["validity"];
  cells: DirectionFitCell[];
  /** Top fit directions (high_fit then supportive), max 3 */
  preferred: Direction8[];
};

export type MetaphysicsPack = {
  version: "metaphysics_pack_v1";
  generated_at: string;
  yong_shen: YongShenOutput;
  element_scores: ElementScoreMap;
  element_scores_source: "chart" | "empty";
  dashboard: DashboardCapacities;
  directions: MetaphysicsDirectionsPack;
  favorable_hours: FavorableHourSlot[];
  color: ElementColorAnchor;
  career: ElementCareerDirection;
  noble: NobleDirectionResult;
};

export function remapDirectionFit(level: DirectionRatingLevel): DirectionFitLevel {
  switch (level) {
    case "highly_favorable":
      return "high_fit";
    case "supportive":
      return "supportive";
    case "neutral":
      return "neutral";
    case "challenging":
      return "friction";
    case "oppressive":
      return "drain";
  }
}
