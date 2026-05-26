/**
 * Syncro v5.1 — local matrix levels + LLM copy for 96 combinations.
 * @see docs/Syncro_Calculation_Engine.md Step 6
 */

import { buildSyncroPrompt } from "@/lib/llm/prompts/syncro-deepseek-prompt";
import { callLLM } from "@/lib/llm/router";
import { getStoredProfile, recordProfileUsage } from "@/lib/profile/stored-profiles-service";
import type { UserProfile } from "@/lib/profile/types";
import {
  calculateSyncroMatrix,
  type MatrixCell,
  type SyncroMatrixMetadata,
  type SyncroMatrixProfile,
} from "@/lib/syncro/calculate-matrix";
import type { CurrentLevel } from "@/lib/syncro/current-system";
import type { SyncroMatrix } from "@/lib/syncro/types";

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
    local_computation: boolean;
    distribution: Record<CurrentLevel, number>;
    llm_batches?: number;
    true_solar_time?: string;
    local_time?: string;
    true_solar_time_diff_minutes?: number;
  };
};

const SYNCRO_LLM_BATCH_COUNT = 6;
const SYNCRO_LLM_MAX_TOKENS_PER_BATCH = 12_000;

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

function toMatrixProfile(
  profile: UserProfile,
  base_analysis: unknown,
): SyncroMatrixProfile {
  return {
    user_profile: profile,
    base_analysis: {
      content: base_analysis as NonNullable<
        SyncroMatrixProfile["base_analysis"]
      >["content"],
    },
  };
}

function computeDistribution(
  matrix: Record<string, MatrixCell | { current_level: CurrentLevel }>,
): Record<CurrentLevel, number> {
  const dist: Record<CurrentLevel, number> = {
    open_current: 0,
    following_current: 0,
    stillwater: 0,
    crosscurrent: 0,
    undertow: 0,
  };
  for (const key of Object.keys(matrix)) {
    dist[matrix[key].current_level]++;
  }
  return dist;
}

function mergeLocalMatrixWithLlmAdvice(
  localMatrix: Record<string, MatrixCell>,
  llmMatrix: Record<string, unknown>,
): SyncroMatrix {
  const result: SyncroMatrix = {};

  for (const key of Object.keys(localMatrix)) {
    const local = localMatrix[key];
    const advice =
      llmMatrix[key] && typeof llmMatrix[key] === "object" && !Array.isArray(llmMatrix[key])
        ? (llmMatrix[key] as Record<string, unknown>)
        : {};

    result[key] = {
      hour_period: local.hour_period,
      direction_id: local.direction_id,
      hour_start_iso: local.hour_start_iso,
      hour_end_iso: local.hour_end_iso,
      current_level: local.current_level,
      short_advice:
        asString(advice.short_advice) || generateFallbackShort(local),
      detailed_advice:
        asString(advice.detailed_advice) || generateFallbackDetailed(local),
      rationale:
        asString(advice.rationale) || generateFallbackRationale(local),
    };
  }

  return result;
}

function validateMatrix(matrix: SyncroMatrix): void {
  const count = Object.keys(matrix).length;
  if (count < 96) {
    throw new Error(`Matrix incomplete: only ${count} combinations`);
  }

  for (const [key, combo] of Object.entries(matrix)) {
    if (!combo.short_advice || !combo.detailed_advice || !combo.rationale) {
      throw new Error(`Matrix entry ${key} missing advice fields`);
    }
  }
}

function generateFallbackShort(cell: MatrixCell): string {
  const levelMap: Record<CurrentLevel, string> = {
    open_current: "Move with confidence — the current is fully with you.",
    following_current: "The current supports you, with some effort.",
    stillwater: "The water is still. Pause and observe.",
    crosscurrent: "Crosscurrent. Reconsider this direction.",
    undertow: "Strong undertow. Hold back, choose another path.",
  };
  return levelMap[cell.current_level] ?? "Take a measured approach.";
}

function generateFallbackDetailed(cell: MatrixCell): string {
  return (
    generateFallbackShort(cell) +
    " This pattern emerges from the combination of your chart and the current moment."
  );
}

function generateFallbackRationale(cell: MatrixCell): string {
  const factors = cell._internal.key_factors.join(", ");
  return `This ${cell.current_level.replace(/_/g, " ")} level reflects your chart, favorable element, and this timing–direction pairing (key factors: ${factors}).`;
}

function chunkArray<T>(items: T[], parts: number): T[][] {
  const chunks: T[][] = [];
  const size = Math.ceil(items.length / parts);
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function pickSubMatrix(
  localMatrix: Record<string, MatrixCell>,
  keys: string[],
): Record<string, MatrixCell> {
  const sub: Record<string, MatrixCell> = {};
  for (const key of keys) {
    sub[key] = localMatrix[key];
  }
  return sub;
}

async function fetchLlmAdviceBatch(input: {
  profile: UserProfile;
  base_analysis: unknown;
  task_description: string;
  user_location: GenerateSyncroMatrixInput["user_location"];
  locale: string;
  current_time: Date;
  subMatrix: Record<string, MatrixCell>;
  true_solar?: SyncroMatrixMetadata;
  batch_index: number;
  batch_total: number;
}): Promise<{
  advice: Record<string, unknown>;
  model: string;
  tokens_used: number;
  cost_usd: number;
}> {
  const { system, user } = buildSyncroPrompt({
    profile: input.profile,
    base_analysis: input.base_analysis,
    task_description: input.task_description,
    user_location: input.user_location,
    locale: input.locale,
    current_time: input.current_time,
    matrix: input.subMatrix,
    true_solar: input.true_solar,
    batch_index: input.batch_index,
    batch_total: input.batch_total,
  });

  let result = await callLLM({
    call_type: "deep_analysis",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: SYNCRO_LLM_MAX_TOKENS_PER_BATCH,
    thinking_effort: "medium",
    response_format: "json",
    temperature: 0.55,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonContent(result.content) as Record<string, unknown>;
  } catch (firstError) {
    console.warn(
      `[syncro] JSON parse retry batch ${input.batch_index}/${input.batch_total}:`,
      firstError,
    );
    result = await callLLM({
      call_type: "deep_analysis",
      system,
      messages: [
        { role: "user", content: user },
        {
          role: "user",
          content:
            "Your previous reply was truncated or invalid JSON. Return ONLY valid JSON for this batch. Keep detailed_advice and rationale concise (under 120 words each).",
        },
      ],
      max_tokens: SYNCRO_LLM_MAX_TOKENS_PER_BATCH,
      thinking_effort: "low",
      response_format: "json",
      temperature: 0.4,
    });
    try {
      parsed = parseJsonContent(result.content) as Record<string, unknown>;
    } catch (e) {
      console.error(
        `[syncro] JSON parse failed (batch ${input.batch_index}/${input.batch_total}):`,
        e,
      );
      console.error("[syncro] Raw (first 500):", result.content.slice(0, 500));
      throw new Error("Syncro text generation output is not valid JSON");
    }
  }

  const advice =
    parsed.matrix && typeof parsed.matrix === "object" && !Array.isArray(parsed.matrix)
      ? (parsed.matrix as Record<string, unknown>)
      : {};

  return {
    advice,
    model: result.actual_model,
    tokens_used: result.meta.tokens_used,
    cost_usd: result.meta.cost_usd ?? 0,
  };
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

  const llmStart = Date.now();
  const { profile, base_analysis } = await resolveProfileBundle(input);
  const matrixProfile = toMatrixProfile(profile, base_analysis);
  const startTime = new Date();

  console.log("[syncro] Computing 96 combinations locally...");
  const { matrix: localMatrix, metadata: trueSolarMeta } = calculateSyncroMatrix({
    profile: matrixProfile,
    taskDescription: input.task_description.trim(),
    startTime,
    userTimezone: input.user_location.timezone,
    userLongitude: input.user_location.longitude,
    userLatitude: input.user_location.latitude,
  });

  const distribution = computeDistribution(localMatrix);
  console.log("[syncro] Local matrix distribution:", distribution);

  const allKeys = Object.keys(localMatrix).sort();
  const keyBatches = chunkArray(allKeys, SYNCRO_LLM_BATCH_COUNT);
  const mergedAdvice: Record<string, unknown> = {};
  let totalTokens = 0;
  let totalCost = 0;
  let lastModel = "";

  console.log(
    `[syncro] Calling LLM for text (${keyBatches.length} batches × ~${Math.ceil(allKeys.length / keyBatches.length)} keys, levels locked)...`,
  );

  for (let i = 0; i < keyBatches.length; i++) {
    const batchKeys = keyBatches[i];
    const subMatrix = pickSubMatrix(localMatrix, batchKeys);
    try {
      const batch = await fetchLlmAdviceBatch({
        profile,
        base_analysis,
        task_description: input.task_description.trim(),
        user_location: input.user_location,
        locale: input.locale,
        current_time: startTime,
        subMatrix,
        true_solar: trueSolarMeta,
        batch_index: i + 1,
        batch_total: keyBatches.length,
      });
      Object.assign(mergedAdvice, batch.advice);
      totalTokens += batch.tokens_used;
      totalCost += batch.cost_usd;
      lastModel = batch.model;
      console.log(
        `[syncro] Batch ${i + 1}/${keyBatches.length} done — ${Object.keys(batch.advice).length} keys, ${batch.tokens_used} tokens`,
      );
    } catch (e) {
      console.warn(
        `[syncro] Batch ${i + 1}/${keyBatches.length} failed — fallbacks for ${batchKeys.length} keys:`,
        e,
      );
    }
  }

  const matrix = mergeLocalMatrixWithLlmAdvice(localMatrix, mergedAdvice);
  validateMatrix(matrix);

  const incompleteKeys = Object.keys(matrix).filter(
    (k) => !matrix[k].short_advice || !matrix[k].detailed_advice,
  );
  if (incompleteKeys.length > 0) {
    console.warn("[syncro] Incomplete keys after merge:", incompleteKeys.length);
  }

  if (typeof window !== "undefined") {
    await recordProfileUsage(input.profile_id, "syncro");
  }

  return {
    matrix,
    meta: {
      model: lastModel,
      tokens_used: totalTokens,
      cost_usd: totalCost,
      latency_ms: Date.now() - llmStart,
      local_computation: true,
      distribution,
      llm_batches: keyBatches.length,
      local_time: trueSolarMeta.localTime,
      true_solar_time: trueSolarMeta.trueSolarTime,
      true_solar_time_diff_minutes: trueSolarMeta.diffMinutes,
    },
  };
}
