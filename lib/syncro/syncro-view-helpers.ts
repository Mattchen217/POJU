import { CURRENT_LEVELS, type DirectionId } from "./current-system";
import { matrixKey, type HourPeriod, type SyncroSession } from "./types";

export const SYNCRO_TASK_TIME_KEY = "syncro_task_time";

export type SyncroTaskTimeScope = "now" | "planning";

export type SyncroUiMode = "compass" | "ar" | "view";

const DIRECTION_ORDER: DirectionId[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

const HOUR_PERIOD_SEQUENCE: HourPeriod[] = [
  "zi",
  "chou",
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai",
];

export function inferTaskTimeScope(task: string): SyncroTaskTimeScope {
  const planning =
    /\b(tomorrow|next week|next month|later today|this evening|tonight|next monday|next tuesday)\b/i.test(
      task,
    ) ||
    /(明天|后天|下周|下个月|今晚|明早|明晚|稍后|过几天)/.test(task);
  return planning ? "planning" : "now";
}

export function getInitialSyncroUiMode(input: {
  taskTimeScope: SyncroTaskTimeScope;
  orientationSupported: boolean;
}): SyncroUiMode {
  if (!input.orientationSupported) return "view";
  return input.taskTimeScope === "now" ? "compass" : "view";
}

export function getOrderedHourPeriodsFromSession(session: SyncroSession): HourPeriod[] {
  const firstKeyByPeriod = new Map<HourPeriod, string>();

  for (const key of Object.keys(session.matrix)) {
    const cell = session.matrix[key];
    if (!firstKeyByPeriod.has(cell.hour_period)) {
      firstKeyByPeriod.set(cell.hour_period, key);
    }
  }

  const periods = [...firstKeyByPeriod.keys()];
  periods.sort((a, b) => {
    const ka = firstKeyByPeriod.get(a)!;
    const kb = firstKeyByPeriod.get(b)!;
    return session.matrix[ka].hour_start_iso.localeCompare(session.matrix[kb].hour_start_iso);
  });

  return periods.length > 0 ? periods : HOUR_PERIOD_SEQUENCE;
}

export function findBestDirectionForPeriod(
  session: SyncroSession,
  period: HourPeriod,
): DirectionId {
  let bestDir: DirectionId = "N";
  let bestScore = -1;

  for (const dir of DIRECTION_ORDER) {
    const cell = session.matrix[matrixKey(period, dir)];
    if (!cell) continue;
    const score = CURRENT_LEVELS[cell.current_level].score;
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }

  return bestDir;
}

export type HourProgressState = "past" | "live" | "selected" | "upcoming";

export function resolveHourProgressState(input: {
  period: HourPeriod;
  livePeriod: HourPeriod;
  selectedPeriod: HourPeriod;
  orderedPeriods: HourPeriod[];
}): HourProgressState {
  const { period, livePeriod, selectedPeriod, orderedPeriods } = input;

  if (period === selectedPeriod && period !== livePeriod) {
    return "selected";
  }
  if (period === livePeriod && period === selectedPeriod) {
    return "live";
  }
  if (period === livePeriod) {
    return "live";
  }

  const liveIdx = orderedPeriods.indexOf(livePeriod);
  const idx = orderedPeriods.indexOf(period);
  if (liveIdx === -1 || idx === -1) return "upcoming";
  return idx < liveIdx ? "past" : "upcoming";
}

export function tiltSuggestsMode(beta: number | null): SyncroUiMode | null {
  if (beta == null || Number.isNaN(beta)) return null;
  if (beta > 60) return "compass";
  if (beta < 30) return "ar";
  return null;
}
