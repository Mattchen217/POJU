/**
 * Syncro v5.1 — local matrix levels + LLM copy for 96 combinations.
 * @see docs/Syncro_Calculation_Engine.md Step 6
 */

import { buildSyncroPrompt } from "@/lib/llm/prompts/syncro-deepseek-prompt";
import { callLLM } from "@/lib/llm/router";
import {
  parseAppLocale,
  resolveSyncroOutputLocale,
  type AppLocale,
} from "@/lib/prompts/language-directive";
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

export type SyncroLocalMatrixResult = SyncroMatrixServiceResult & {
  local_matrix: Record<string, MatrixCell>;
  compute_started_at: string;
  true_solar_meta: SyncroMatrixMetadata;
};

export type SyncroLlmBatchResult = {
  batch_index: number;
  batch_total: number;
  advice: Record<string, { short_advice: string; detailed_advice: string; rationale: string }>;
  model: string;
  tokens_used: number;
  cost_usd: number;
};

export const SYNCRO_LLM_BATCH_COUNT = 6;
export const SYNCRO_LLM_MAX_TOKENS_PER_BATCH = 6000;

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

export function computeDistribution(
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

export function mergeLocalMatrixWithLlmAdvice(
  localMatrix: Record<string, MatrixCell>,
  llmMatrix: Record<string, unknown>,
  outputLocale: AppLocale = "en",
): SyncroMatrix {
  const result: SyncroMatrix = {};

  for (const key of Object.keys(localMatrix)) {
    const local = localMatrix[key];
    const advice =
      llmMatrix[key] && typeof llmMatrix[key] === "object" && !Array.isArray(llmMatrix[key])
        ? (llmMatrix[key] as Record<string, unknown>)
        : {};

    const hasLlmAdvice =
      Boolean(asString(advice.short_advice)) ||
      Boolean(asString(advice.detailed_advice)) ||
      Boolean(asString(advice.rationale));

    result[key] = {
      hour_period: local.hour_period,
      direction_id: local.direction_id,
      hour_start_iso: local.hour_start_iso,
      hour_end_iso: local.hour_end_iso,
      current_level: local.current_level,
      short_advice:
        asString(advice.short_advice) || generateFallbackShort(local, outputLocale),
      detailed_advice:
        asString(advice.detailed_advice) || generateFallbackDetailed(local, outputLocale),
      rationale:
        asString(advice.rationale) || generateFallbackRationale(local, outputLocale),
      llm_pending: !hasLlmAdvice,
    };
  }

  return result;
}

export function matrixWithFallbacksOnly(
  localMatrix: Record<string, MatrixCell>,
  outputLocale: AppLocale = "en",
): SyncroMatrix {
  return mergeLocalMatrixWithLlmAdvice(localMatrix, {}, outputLocale);
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

export function generateFallbackShort(cell: MatrixCell, outputLocale: AppLocale = "en"): string {
  const en: Record<CurrentLevel, string> = {
    open_current: "Move with confidence — the current is fully with you.",
    following_current: "The current supports you, with some effort.",
    stillwater: "The water is still. Pause and observe.",
    crosscurrent: "Crosscurrent. Reconsider this direction.",
    undertow: "Strong undertow. Hold back, choose another path.",
  };
  const zh: Record<CurrentLevel, string> = {
    open_current: "顺势而动——此刻能量与你同行。",
    following_current: "有助力，但仍需你主动配合。",
    stillwater: "水势静止，先观察再行动。",
    crosscurrent: "横流扰动，宜暂缓或改向。",
    undertow: "暗流较强，不宜硬推，另择时机或方位。",
  };
  const map = outputLocale === "zh" ? zh : en;
  return map[cell.current_level] ?? (outputLocale === "zh" ? "谨慎推进。" : "Take a measured approach.");
}

export function generateFallbackDetailed(cell: MatrixCell, outputLocale: AppLocale = "en"): string {
  const tail =
    outputLocale === "zh"
      ? " 这一判断来自你的命盘与当下时空格局的综合作用。"
      : " This pattern emerges from the combination of your chart and the current moment.";
  return generateFallbackShort(cell, outputLocale) + tail;
}

export function generateFallbackRationale(cell: MatrixCell, outputLocale: AppLocale = "en"): string {
  const factors = cell._internal.key_factors.join(", ");
  if (outputLocale === "zh") {
    return `此组合为 ${cell.current_level.replace(/_/g, " ")} 档，综合命盘、用神与此刻时辰×方位的作用（主要因素：${factors}）。`;
  }
  return `This ${cell.current_level.replace(/_/g, " ")} level reflects your chart, favorable element, and this timing–direction pairing (key factors: ${factors}).`;
}

export function chunkArray<T>(items: T[], parts: number): T[][] {
  const chunks: T[][] = [];
  const size = Math.ceil(items.length / parts);
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function getSyncroBatchKeyLists(localMatrix: Record<string, MatrixCell>): string[][] {
  const allKeys = Object.keys(localMatrix).sort();
  return chunkArray(allKeys, SYNCRO_LLM_BATCH_COUNT);
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

export async function fetchLlmAdviceBatch(input: {
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
  output_locale?: AppLocale;
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
    call_type: "syncro_batch",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: SYNCRO_LLM_MAX_TOKENS_PER_BATCH,
    thinking_effort: "low",
    response_format: "json",
    temperature: 0.55,
    timeout_ms: 90_000,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonContent(result.content) as Record<string, unknown>;
  } catch (firstError) {
    console.warn(
      `[syncro] JSON parse retry batch ${input.batch_index}/${input.batch_total}:`,
      firstError,
    );
    const outputLocale =
      input.output_locale ??
      resolveSyncroOutputLocale(parseAppLocale(input.locale), input.task_description);
    const retryHint =
      outputLocale === "zh"
        ? "上次回复被截断或不是合法 JSON。请只返回本批合法 JSON。detailed_advice 与 rationale 各控制在约 120 字以内。"
        : "Your previous reply was truncated or invalid JSON. Return ONLY valid JSON for this batch. Keep detailed_advice and rationale concise (under 120 words each).";

    result = await callLLM({
      call_type: "syncro_batch",
      system,
      messages: [
        { role: "user", content: user },
        {
          role: "user",
          content: retryHint,
        },
      ],
      max_tokens: SYNCRO_LLM_MAX_TOKENS_PER_BATCH,
      thinking_effort: "low",
      response_format: "json",
      temperature: 0.4,
      timeout_ms: 90_000,
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

function normalizeBatchAdvice(
  raw: Record<string, unknown>,
): Record<string, { short_advice: string; detailed_advice: string; rationale: string }> {
  const out: Record<string, { short_advice: string; detailed_advice: string; rationale: string }> =
    {};
  for (const [key, val] of Object.entries(raw)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const row = val as Record<string, unknown>;
    const short_advice = asString(row.short_advice);
    const detailed_advice = asString(row.detailed_advice);
    const rationale = asString(row.rationale);
    if (!short_advice && !detailed_advice && !rationale) continue;
    out[key] = { short_advice, detailed_advice, rationale };
  }
  return out;
}

/** Local 96-cell matrix + fallback copy only (no LLM). Target &lt; 15s server-side. */
export async function generateSyncroMatrixLocal(
  input: GenerateSyncroMatrixInput,
): Promise<SyncroLocalMatrixResult> {
  if (!input.profile_id?.trim()) {
    throw new Error("profile_id is required");
  }
  if (!input.task_description?.trim()) {
    throw new Error("task_description is required");
  }

  const startMs = Date.now();
  const { profile, base_analysis } = await resolveProfileBundle(input);
  const matrixProfile = toMatrixProfile(profile, base_analysis);
  const startTime = new Date();

  console.log("[syncro] Computing 96 combinations locally (no LLM)...");
  const { matrix: localMatrix, metadata: trueSolarMeta } = calculateSyncroMatrix({
    profile: matrixProfile,
    taskDescription: input.task_description.trim(),
    startTime,
    userTimezone: input.user_location.timezone,
    userLongitude: input.user_location.longitude,
    userLatitude: input.user_location.latitude,
  });

  const outputLocale = resolveSyncroOutputLocale(
    parseAppLocale(input.locale),
    input.task_description.trim(),
  );

  const distribution = computeDistribution(localMatrix);
  const matrix = matrixWithFallbacksOnly(localMatrix, outputLocale);
  validateMatrix(matrix);

  if (typeof window !== "undefined") {
    await recordProfileUsage(input.profile_id, "syncro");
  }

  const latency_ms = Date.now() - startMs;
  console.log(`[syncro] Local matrix done in ${latency_ms}ms`);

  return {
    matrix,
    local_matrix: localMatrix,
    compute_started_at: startTime.toISOString(),
    true_solar_meta: trueSolarMeta,
    meta: {
      model: "local",
      tokens_used: 0,
      cost_usd: 0,
      latency_ms,
      local_computation: true,
      distribution,
      llm_batches: SYNCRO_LLM_BATCH_COUNT,
      local_time: trueSolarMeta.localTime,
      true_solar_time: trueSolarMeta.trueSolarTime,
      true_solar_time_diff_minutes: trueSolarMeta.diffMinutes,
    },
  };
}

/** Single LLM batch (0-based index). Used by `/api/syncro/llm_batch`. */
export async function runSyncroLlmBatch(input: {
  batch_index: number;
  profile: UserProfile;
  base_analysis: unknown;
  task_description: string;
  user_location: GenerateSyncroMatrixInput["user_location"];
  locale: string;
  local_matrix: Record<string, MatrixCell>;
  compute_started_at: string;
  true_solar?: SyncroMatrixMetadata;
}): Promise<SyncroLlmBatchResult> {
  const batches = getSyncroBatchKeyLists(input.local_matrix);
  if (input.batch_index < 0 || input.batch_index >= batches.length) {
    throw new Error(`batch_index must be 0..${batches.length - 1}`);
  }

  const batchKeys = batches[input.batch_index]!;
  const subMatrix = pickSubMatrix(input.local_matrix, batchKeys);
  const current_time = new Date(input.compute_started_at);
  const outputLocale = resolveSyncroOutputLocale(
    parseAppLocale(input.locale),
    input.task_description,
  );

  const batch = await fetchLlmAdviceBatch({
    profile: input.profile,
    base_analysis: input.base_analysis,
    task_description: input.task_description.trim(),
    user_location: input.user_location,
    locale: input.locale,
    current_time,
    subMatrix,
    true_solar: input.true_solar,
    batch_index: input.batch_index + 1,
    batch_total: batches.length,
    output_locale: outputLocale,
  });

  return {
    batch_index: input.batch_index,
    batch_total: batches.length,
    advice: normalizeBatchAdvice(batch.advice),
    model: batch.model,
    tokens_used: batch.tokens_used,
    cost_usd: batch.cost_usd,
  };
}

/** Legacy: local + all LLM batches in one request (tests / scripts). */
export async function generateSyncroMatrix(
  input: GenerateSyncroMatrixInput,
): Promise<SyncroMatrixServiceResult> {
  const llmStart = Date.now();
  const localResult = await generateSyncroMatrixLocal(input);
  const { profile, base_analysis } = await resolveProfileBundle(input);

  const mergedAdvice: Record<string, unknown> = {};
  let totalTokens = 0;
  let totalCost = 0;
  let lastModel = "";

  const batches = getSyncroBatchKeyLists(localResult.local_matrix);
  console.log(`[syncro] Calling LLM for text (${batches.length} batches, sequential)...`);

  for (let i = 0; i < batches.length; i++) {
    const batchKeys = batches[i]!;
    const subMatrix = pickSubMatrix(localResult.local_matrix, batchKeys);
    try {
      const batch = await fetchLlmAdviceBatch({
        profile,
        base_analysis,
        task_description: input.task_description.trim(),
        user_location: input.user_location,
        locale: input.locale,
        current_time: new Date(localResult.compute_started_at),
        subMatrix,
        true_solar: localResult.true_solar_meta,
        batch_index: i + 1,
        batch_total: batches.length,
      });
      Object.assign(mergedAdvice, batch.advice);
      totalTokens += batch.tokens_used;
      totalCost += batch.cost_usd;
      lastModel = batch.model;
      console.log(`[syncro] Batch ${i + 1}/${batches.length} done`);
    } catch (e) {
      console.warn(`[syncro] Batch ${i + 1}/${batches.length} failed:`, e);
    }
  }

  const outputLocale = resolveSyncroOutputLocale(
    parseAppLocale(input.locale),
    input.task_description.trim(),
  );
  const matrix = mergeLocalMatrixWithLlmAdvice(
    localResult.local_matrix,
    mergedAdvice,
    outputLocale,
  );
  validateMatrix(matrix);

  return {
    matrix,
    meta: {
      ...localResult.meta,
      model: lastModel || localResult.meta.model,
      tokens_used: totalTokens,
      cost_usd: totalCost,
      latency_ms: Date.now() - llmStart,
    },
  };
}
