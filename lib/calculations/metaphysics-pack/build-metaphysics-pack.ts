import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { calculateDirections } from "@/lib/calculations/modules/m6-directions";
import type { Direction8, FiveElement } from "@/lib/calculations/types";
import { getBaziChart } from "shunshi-bazi-core";

import { buildProfileStructured } from "@/lib/calculations/build-profile-structured";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { UserProfile } from "@/lib/profile/types";

import {
  careerDirectionForElement,
  colorAnchorForElement,
  dashboardCapacitiesFromScores,
  favorableHours,
  normalizeElementScores,
  resolveDayMasterElement,
  type WuXingScoreRaw,
} from "./element-adaptations";
import { toFiveElement } from "./element-token";
import { nobleDirection } from "./noble-direction";
import {
  remapDirectionFit,
  type DirectionFitCell,
  type MetaphysicsPack,
} from "./types";
import { buildYongShenOutputForM6 } from "./yong-shen-to-m6";

const DIR_ORDER: Direction8[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export type BuildMetaphysicsPackInput = {
  structured: ProfileStructured;
  /** Raw chart 五行分值 — required for real P1 dashboard numbers */
  element_scores_raw?: WuXingScoreRaw | null;
  current_time?: string | Date;
  device_orientation?: number;
};

function pickPreferred(cells: DirectionFitCell[]): Direction8[] {
  const rank: Record<DirectionFitCell["fit"], number> = {
    high_fit: 0,
    supportive: 1,
    neutral: 2,
    friction: 3,
    drain: 4,
  };
  return [...cells]
    .filter((c) => c.fit === "high_fit" || c.fit === "supportive")
    .sort((a, b) => {
      const rd = rank[a.fit] - rank[b.fit];
      if (rd !== 0) return rd;
      return b.combined_score - a.combined_score;
    })
    .slice(0, 3)
    .map((c) => c.direction);
}

/**
 * Layer 1 deterministic 玄学实操料.
 * Pure calc — no LLM. Safe to console.log for smoke checks.
 */
export function buildMetaphysicsPack(input: BuildMetaphysicsPackInput): MetaphysicsPack {
  const at =
    input.current_time instanceof Date
      ? input.current_time
      : new Date(input.current_time ?? Date.now());

  const yong = buildYongShenOutputForM6(input.structured);
  const xi = (input.structured.xi_shen ?? [])
    .map((t) => toFiveElement(t))
    .filter((el): el is FiveElement => el != null);

  const m6 = calculateDirections({
    yong_shen: yong,
    current_time: at.toISOString(),
    device_orientation: input.device_orientation,
  });

  const cells: DirectionFitCell[] = DIR_ORDER.map((direction) => {
    const cell = m6.ratings[direction];
    return {
      direction,
      base_element: cell.base_element,
      combined_score: cell.combined_score,
      m6_rating: cell.rating,
      fit: remapDirectionFit(cell.rating),
      brief_note: cell.brief_note,
    };
  });

  const { scores, source } = normalizeElementScores(input.element_scores_raw);
  const dayMasterEl =
    resolveDayMasterElement(input.element_scores_raw?.日主五行) ??
    resolveDayMasterElement(input.structured.day_master);

  const dashboard = dashboardCapacitiesFromScores({
    scores,
    day_master_element: dayMasterEl,
    primary_yong_shen: yong.primary_yong_shen,
    primary_ji_shen: yong.ji_shen[0] ?? "earth",
  });

  return {
    version: "metaphysics_pack_v1",
    generated_at: new Date().toISOString(),
    yong_shen: yong,
    element_scores: scores,
    element_scores_source: source,
    dashboard,
    directions: {
      yong_shen: yong,
      current_hour: m6.current_hour,
      validity: m6.validity,
      cells,
      preferred: pickPreferred(cells),
    },
    favorable_hours: favorableHours({
      primary_yong_shen: yong.primary_yong_shen,
      xi_shen: xi,
    }),
    color: colorAnchorForElement(yong.primary_yong_shen),
    career: careerDirectionForElement(yong.primary_yong_shen),
    noble: nobleDirection(input.structured),
  };
}

/** Convenience: chart + structured from profile, then pack. */
export function buildMetaphysicsPackFromProfile(
  profile: UserProfile,
  options?: { current_time?: string | Date; device_orientation?: number },
): MetaphysicsPack {
  const params = shunshiParamsFromBirthInfo(profile.birth);
  const chart = getBaziChart({
    year: params.year,
    month: params.month,
    day: params.day,
    hour: params.hour,
    minute: params.minute,
    gender: params.gender,
    city: params.city,
    latitude: params.latitude,
    longitude: params.longitude,
    standardMeridian: params.standardMeridian,
    useTrueSolarTime: true,
    sect: 1,
  });

  const structured = buildProfileStructured({ profile, chart });
  const element_scores_raw = chart.八字?.五行分值 as WuXingScoreRaw | undefined;

  return buildMetaphysicsPack({
    structured,
    element_scores_raw,
    current_time: options?.current_time,
    device_orientation: options?.device_orientation,
  });
}
