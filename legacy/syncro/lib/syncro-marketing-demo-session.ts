import { CURRENT_LEVELS, type CurrentLevel, type DirectionId } from "@/lib/syncro/current-system";
import { HOUR_ORDER } from "@/lib/syncro/hour-order";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

const DIRECTIONS: DirectionId[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Demo level pattern — varied colors on MAP ring. */
const DEMO_LEVELS: CurrentLevel[] = [
  "open_current",
  "following_current",
  "stillwater",
  "crosscurrent",
  "undertow",
  "following_current",
  "open_current",
  "stillwater",
];

function adviceFor(level: CurrentLevel, isZh: boolean): string {
  const info = CURRENT_LEVELS[level];
  return isZh ? info.default_advice_zh : info.default_advice_en;
}

/** Static session for marketing phone preview — no API / Dexie. */
export function buildSyncroMarketingDemoSession(locale: string): SyncroSession {
  const isZh = locale.startsWith("zh");
  const matrix: SyncroSession["matrix"] = {};
  const now = new Date();

  for (const period of HOUR_ORDER) {
    for (let i = 0; i < DIRECTIONS.length; i++) {
      const direction = DIRECTIONS[i]!;
      const level = DEMO_LEVELS[i] ?? "stillwater";
      const key = matrixKey(period, direction);
      matrix[key] = {
        hour_period: period,
        direction_id: direction,
        hour_start_iso: now.toISOString(),
        hour_end_iso: now.toISOString(),
        current_level: level,
        short_advice: adviceFor(level, isZh),
        detailed_advice: adviceFor(level, isZh),
        rationale: isZh ? "演示数据 — 安装 PWA 后可获得针对你任务的实时解读。" : "Demo data — install the PWA for guidance tailored to your task.",
        llm_pending: false,
      };
    }
  }

  return {
    session_id: "marketing-demo",
    device_id: "marketing-demo",
    profile_id: "marketing-demo",
    task_description: isZh ? "今日重要会议" : "Important meeting today",
    user_location: { latitude: 31.23, longitude: 121.47, timezone: "Asia/Shanghai" },
    created_at: now,
    expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    matrix,
    locale,
    is_free: true,
    cost_usd: 0,
    llm_meta: { model: "demo", tokens_used: 0, latency_ms: 0 },
  };
}

export const SYNCRO_MARKETING_DEMO_LIVE_PERIOD: HourPeriod = "wu";
