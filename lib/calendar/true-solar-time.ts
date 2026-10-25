/**
 * True solar time for Syncro / BaZi timing.
 * @see docs/Syncro_TrueSolarTime_Final.md Step 3
 *
 * 真太阳时 = 本地时间 + 经度时差 + 时差方程
 * 经度时差(分钟) = (本地经度 - 时区中央经度) × 4
 */

export interface TrueSolarTimeResult {
  /** Instant adjusted toward true solar time (same epoch semantics as input localTime). */
  trueSolarTime: Date;
  /** Total correction vs local civil time (minutes). */
  diffMinutes: number;
  longitudeDiffMinutes: number;
  eqOfTimeMinutes: number;
}

export function calculateTrueSolarTime(input: {
  localTime: Date;
  longitude: number;
  timezone: string;
}): TrueSolarTimeResult {
  const { localTime, longitude, timezone } = input;

  const tzOffsetMinutes = getTimezoneOffsetMinutes(timezone, localTime);
  const tzCenterLongitude = (tzOffsetMinutes / 60) * 15;

  const longitudeDiffMinutes = (longitude - tzCenterLongitude) * 4;

  const dayOfYear = getDayOfYear(localTime);
  const eqOfTimeMinutes = calculateEquationOfTime(dayOfYear);

  const totalDiffMinutes = longitudeDiffMinutes + eqOfTimeMinutes;
  const trueSolarTime = new Date(localTime.getTime() + totalDiffMinutes * 60 * 1000);

  return {
    trueSolarTime,
    diffMinutes: round2(totalDiffMinutes),
    longitudeDiffMinutes: round2(longitudeDiffMinutes),
    eqOfTimeMinutes: round2(eqOfTimeMinutes),
  };
}

/** Minutes east of UTC for the given IANA zone at `date` (DST-aware). */
export function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const parts = dtf.formatToParts(date);
    const dateParts: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== "literal") dateParts[part.type] = part.value;
    }

    const tzDate = new Date(
      `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}Z`,
    );

    return (tzDate.getTime() - date.getTime()) / (1000 * 60);
  } catch {
    return 0;
  }
}

/** Equation of time (minutes); simplified formula, ~±1 min accuracy. */
export function calculateEquationOfTime(dayOfYear: number): number {
  const b = (2 * Math.PI * (dayOfYear - 81)) / 365;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

export function getDayOfYear(date: Date): number {
  const y = date.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const utcMidnight = Date.UTC(y, date.getUTCMonth(), date.getUTCDate());
  return Math.floor((utcMidnight - start) / (1000 * 60 * 60 * 24)) + 1;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ZonedCalendarParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Wall-clock fields for `date` in an IANA timezone (device/PC civil time). */
export function getZonedCalendarParts(date: Date, timeZone: string): ZonedCalendarParts {
  if (!timeZone || timeZone === "UTC") {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    };
  }

  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts: Record<string, string> = {};
    for (const part of dtf.formatToParts(date)) {
      if (part.type !== "literal") parts[part.type] = part.value;
    }
    return {
      year: parseInt(parts.year ?? "1970", 10),
      month: parseInt(parts.month ?? "1", 10),
      day: parseInt(parts.day ?? "1", 10),
      hour: parseInt(parts.hour ?? "0", 10),
      minute: parseInt(parts.minute ?? "0", 10),
      second: parseInt(parts.second ?? "0", 10),
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }
}

/** UTC instant for a civil datetime in `timeZone` (works on server UTC or client local). */
export function zonedLocalToUtc(
  local: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute?: number;
    second?: number;
  },
  timeZone: string,
): Date {
  const minute = local.minute ?? 0;
  const second = local.second ?? 0;

  if (!timeZone || timeZone === "UTC") {
    return new Date(
      Date.UTC(local.year, local.month - 1, local.day, local.hour, minute, second),
    );
  }

  let utcMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, minute, second);
  for (let i = 0; i < 4; i++) {
    const offsetMin = getTimezoneOffsetMinutes(timeZone, new Date(utcMs));
    utcMs =
      Date.UTC(local.year, local.month - 1, local.day, local.hour, minute, second) -
      offsetMin * 60 * 1000;
  }
  return new Date(utcMs);
}
