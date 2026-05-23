/**
 * Syncro v5 — DeepSeek 96-combination matrix via `callLLM({ call_type: 'deep_analysis' })`.
 */

import { buildSyncroPrompt } from "@/lib/llm/prompts/syncro-deepseek-prompt";
import { callLLM } from "@/lib/llm/router";
import { getStoredProfile, recordProfileUsage } from "@/lib/profile/stored-profiles-service";
import type { UserProfile } from "@/lib/profile/types";
import { CURRENT_LEVELS, DIRECTIONS, type CurrentLevel, type DirectionId } from "@/lib/syncro/current-system";
import { generateNext12HourPeriodSlots } from "@/lib/syncro/hour-period-slots";
import { HOUR_PERIODS, type HourPeriod, type SyncroMatrix } from "@/lib/syncro/types";

const DIRECTION_IDS = Object.keys(DIRECTIONS) as DirectionId[];
const VALID_LEVELS = new Set(Object.keys(CURRENT_LEVELS));

export type GenerateSyncroMatrixInput = {
  profile_id: string;
  task_description: string;
  user_location: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  locale: string;
  user_profile?: UserProfile | null;
  base_analysis?: unknown | null;
};

export type SyncroMatrixServiceResult = {
  matrix: SyncroMatrix;
  meta: {
    model: string;
    tokens_used: number;
    cost_usd: number;
    latency_ms: number;
  };
};

function parseJsonContent(raw: string): unknown {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/g, "")
    .trim();
  return JSON.parse(cleaned) as unknown;
}

async function resolveProfileBundle(input: GenerateSyncroMatrixInput): Promise<{
  profile: UserProfile;
  base_analysis: unknown;
}> {
  if (input.user_profile && input.base_analysis != null) {
    return { profile: input.user_profile, base_analysis: input.base_analysis };
  }

  if (typeof window !== "undefined" && input.profile_id) {
    const row = await getStoredProfile(input.profile_id);
    if (row?.user_profile && row.base_analysis?.content != null) {
      return {
        profile: row.user_profile,
        base_analysis: row.base_analysis.content,
      };
    }
  }

  throw new Error(
    "Profile has no base_analysis. Complete Syncro prepare first, or pass user_profile + base_analysis in the request.",
  );
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseMatrixKey(key: string): { hour_period: HourPeriod; direction_id: DirectionId } | null {
  const parts = key.split("__");
  if (parts.length !== 2) return null;
  const [hour_period, direction_id] = parts;
  if (!(hour_period in HOUR_PERIODS)) return null;
  if (!DIRECTION_IDS.includes(direction_id as DirectionId)) return null;
  return { hour_period: hour_period as HourPeriod, direction_id: direction_id as DirectionId };
}

function normalizeMatrix(
  rawMatrix: Record<string, unknown>,
  slots: ReturnType<typeof generateNext12HourPeriodSlots>,
): SyncroMatrix {
  const slotByPeriod = Object.fromEntries(slots.map((s) => [s.hour_period, s]));
  const matrix: SyncroMatrix = {};

  for (const [key, value] of Object.entries(rawMatrix)) {
    const parsedKey = parseMatrixKey(key);
    if (!parsedKey) continue;

    const entry =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    const level = asString(entry.current_level) as CurrentLevel;
    if (!VALID_LEVELS.has(level)) continue;

    const slot = slotByPeriod[parsedKey.hour_period];
    matrix[key] = {
      hour_period: parsedKey.hour_period,
      direction_id: parsedKey.direction_id,
      hour_start_iso: slot?.start_time ?? asString(entry.hour_start_iso),
      hour_end_iso: slot?.end_time ?? asString(entry.hour_end_iso),
      current_level: level,
      short_advice: asString(entry.short_advice),
      detailed_advice: asString(entry.detailed_advice),
      rationale: asString(entry.rationale),
    };
  }

  return matrix;
}

function validateMatrix(matrix: SyncroMatrix): void {
  const count = Object.keys(matrix).length;
  if (count < 90) {
    throw new Error(`Matrix incomplete: only ${count} combinations`);
  }

  for (const [key, combo] of Object.entries(matrix)) {
    if (!combo.short_advice || !combo.detailed_advice || !combo.rationale) {
      throw new Error(`Matrix entry ${key} missing advice fields`);
    }
  }
}

export async function generateSyncroMatrix(
  input: GenerateSyncroMatrixInput,
): Promise<SyncroMatrixServiceResult> {
  if (!input.profile_id?.trim()) {
    throw new Error("profile_id is required");
  }
  if (!input.task_description?.trim()) {
    throw new Error("task_description is required");
  }

  const startTime = Date.now();
  const slots = generateNext12HourPeriodSlots(new Date());
  const { profile, base_analysis } = await resolveProfileBundle(input);

  const { system, user } = buildSyncroPrompt({
    profile,
    base_analysis,
    task_description: input.task_description.trim(),
    user_location: input.user_location,
    locale: input.locale,
    current_time: new Date(),
  });

  console.log("[syncro] Calling DeepSeek V4 Pro for 96 combinations...");

  const result = await callLLM({
    call_type: "deep_analysis",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 20_000,
    thinking_effort: "high",
    response_format: "json",
    temperature: 0.55,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonContent(result.content) as Record<string, unknown>;
  } catch (e) {
    console.error("[syncro] JSON parse failed:", e);
    console.error("[syncro] Raw (first 800):", result.content.slice(0, 800));
    throw new Error("Syncro matrix output is not valid JSON");
  }

  const rawMatrix =
    parsed.matrix && typeof parsed.matrix === "object" && !Array.isArray(parsed.matrix)
      ? (parsed.matrix as Record<string, unknown>)
      : parsed;

  const matrix = normalizeMatrix(
    rawMatrix && typeof rawMatrix === "object" ? (rawMatrix as Record<string, unknown>) : {},
    slots,
  );

  validateMatrix(matrix);

  if (typeof window !== "undefined") {
    await recordProfileUsage(input.profile_id, "syncro");
  }

  return {
    matrix,
    meta: {
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      cost_usd: result.meta.cost_usd,
      latency_ms: Date.now() - startTime,
    },
  };
}
