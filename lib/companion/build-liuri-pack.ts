/**
 * Deterministic 30-day AtmosEngineSnapshot pack from delivery day.
 */

import {
  buildAtmosEngineSnapshot,
  type AtmosEngineSnapshot,
} from "@/lib/atmos/build-atmos-engine-snapshot";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { zonedLocalToUtc } from "@/lib/calendar/true-solar-time";

import { addDaysKey, parseDateKey } from "./date-keys";
import { COMPANION_WINDOW_DAYS } from "./types";

export function buildLiuriPack(input: {
  structured: ProfileStructured;
  deliveryDayKey: string;
  timezone: string;
}): AtmosEngineSnapshot[] {
  const pack: AtmosEngineSnapshot[] = [];
  for (let i = 0; i < COMPANION_WINDOW_DAYS; i++) {
    const dateKey = addDaysKey(input.deliveryDayKey, i);
    const ymd = parseDateKey(dateKey);
    const asOf = zonedLocalToUtc(
      {
        year: ymd.year,
        month: ymd.month,
        day: ymd.day,
        hour: 12,
        minute: 0,
        second: 0,
      },
      input.timezone,
    );
    pack.push(
      buildAtmosEngineSnapshot({
        structured: input.structured,
        date: asOf,
        timezone: input.timezone,
      }),
    );
  }
  return pack;
}
