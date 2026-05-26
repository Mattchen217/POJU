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
