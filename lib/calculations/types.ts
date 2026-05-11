/** v4.0 计算层类型（Batch1 §2.2 / Batch2 §5.2）— 先覆盖 Syncro M6 所需字段 */

export type FiveElement = "wood" | "fire" | "earth" | "metal" | "water";

export type Direction8 = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export type DirectionRatingLevel =
  | "highly_favorable"
  | "supportive"
  | "neutral"
  | "challenging"
  | "oppressive";

export interface YongShenOutput {
  primary_yong_shen: FiveElement;
  /** 忌神（至少一项，供 M6 扣分） */
  ji_shen: FiveElement[];
}

export interface DirectionRating {
  base_element: FiveElement;
  combined_score: number;
  rating: DirectionRatingLevel;
  brief_note: string;
}

export interface DirectionsOutput {
  current_hour: {
    branch: string;
    element: FiveElement;
    period: string;
  };
  ratings: Record<Direction8, DirectionRating>;
  current_facing: Direction8 | null;
  validity: {
    valid_until: string;
    is_current_zhi_shi: boolean;
  };
}
