import { CURRENT_LEVELS, type CurrentLevel } from "./current-system";
import type { HourPeriod } from "./types";

const LEVEL_I18N_KEY: Record<CurrentLevel, "open" | "following" | "still" | "cross" | "under"> = {
  open_current: "open",
  following_current: "following",
  stillwater: "still",
  crosscurrent: "cross",
  undertow: "under",
};

export function getCurrentLevelI18nKey(level: CurrentLevel): (typeof LEVEL_I18N_KEY)[CurrentLevel] {
  return LEVEL_I18N_KEY[level];
}

export function getCurrentLevelLabel(
  level: CurrentLevel,
  t: (key: `levels.${(typeof LEVEL_I18N_KEY)[CurrentLevel]}`) => string,
): string {
  return t(`levels.${LEVEL_I18N_KEY[level]}`);
}

export function getCurrentLevelFallbackLabel(level: CurrentLevel, isZh: boolean): string {
  const info = CURRENT_LEVELS[level];
  return isZh ? info.name_zh : info.name_en;
}

/** CSS status class suffix for map points (e.g. `status-open`). */
export function currentLevelMapPointStatusClass(level: CurrentLevel): string {
  const MAP_STATUS: Record<CurrentLevel, string> = {
    open_current: "open",
    following_current: "following",
    stillwater: "still",
    crosscurrent: "cross",
    undertow: "under",
  };
  return MAP_STATUS[level];
}
