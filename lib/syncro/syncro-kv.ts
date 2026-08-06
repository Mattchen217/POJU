import { kv } from "@/lib/kv/client";
import type { AppLocale } from "@/lib/prompts/language-directive";
import { HOUR_ORDER } from "@/lib/syncro/hour-order";
import type { HourPeriod } from "@/lib/syncro/types";

const OUTPUT_LOCALE_VARIANTS: AppLocale[] = ["en", "es", "zh", "fr"];

const TTL_INPUT = 30 * 60;
const TTL_OUTPUT = 10 * 60;

export type SyncroLlmInputCache = {
  system: string;
  user: string;
  model: string;
};

function isKvConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim(),
  );
}

function inputKey(sessionId: string, hourId: string): string {
  return `syncro:input:${sessionId}:${hourId}`;
}

function outputKey(sessionId: string, outputLocale: string, hourId: string): string {
  return `syncro:output:${sessionId}:${outputLocale}:${hourId}`;
}

export async function cacheLlmInput(
  sessionId: string,
  hourId: string,
  input: SyncroLlmInputCache,
): Promise<void> {
  if (!isKvConfigured()) return;
  await kv.set(inputKey(sessionId, hourId), input, { ex: TTL_INPUT });
}

export async function getCachedInput(
  sessionId: string,
  hourId: string,
): Promise<SyncroLlmInputCache | null> {
  if (!isKvConfigured()) return null;
  return (await kv.get<SyncroLlmInputCache>(inputKey(sessionId, hourId))) ?? null;
}

export async function cacheLlmOutput(
  sessionId: string,
  outputLocale: string,
  hourId: string,
  advice: Record<string, { short_advice: string; detailed_advice: string; rationale: string }>,
): Promise<void> {
  if (!isKvConfigured()) return;
  await kv.set(outputKey(sessionId, outputLocale, hourId), advice, { ex: TTL_OUTPUT });
}

export async function getCachedOutput(
  sessionId: string,
  outputLocale: string,
  hourId: string,
): Promise<Record<string, { short_advice: string; detailed_advice: string; rationale: string }> | null> {
  if (!isKvConfigured()) return null;
  return (
    (await kv.get<
      Record<string, { short_advice: string; detailed_advice: string; rationale: string }>
    >(outputKey(sessionId, outputLocale, hourId))) ?? null
  );
}

export async function clearHourCache(sessionId: string, hourId: string): Promise<void> {
  if (!isKvConfigured()) return;
  await Promise.all([
    kv.del(inputKey(sessionId, hourId)),
    ...OUTPUT_LOCALE_VARIANTS.map((loc) => kv.del(outputKey(sessionId, loc, hourId))),
    kv.del(`syncro:stream:${sessionId}:${hourId}`),
  ]);
}

export async function clearSessionCache(sessionId: string): Promise<void> {
  if (!isKvConfigured()) return;
  const keys = HOUR_ORDER.flatMap((hourId) => [
    inputKey(sessionId, hourId),
    ...OUTPUT_LOCALE_VARIANTS.map((loc) => outputKey(sessionId, loc, hourId)),
    `syncro:stream:${sessionId}:${hourId}`,
  ]);
  if (keys.length > 0) await kv.del(...keys);
}

// ============================================================
// Stream 累积(用于 SSE 流式 LLM 输出的中间缓冲)
// ============================================================

const TTL_STREAM = 30 * 60; // 30 分钟(跟 input 一致)

/**
 * 追加一个 chunk 到流缓冲
 * 用 Redis APPEND 原子操作,LLM 流式输出按顺序追加
 */
export async function appendToStream(
  sessionId: string,
  hourId: string,
  chunk: string,
): Promise<void> {
  if (!chunk) return;

  const key = `syncro:stream:${sessionId}:${hourId}`;

  try {
    await kv.append(key, chunk);
    // APPEND 不会自动设 TTL,需要单独 expire
    await kv.expire(key, TTL_STREAM);
  } catch (e) {
    // KV 失败不应阻塞 LLM 流,只记日志
    console.warn("[syncro-kv] appendToStream failed:", e);
  }
}

/**
 * 获取累积的流内容
 * 用于客户端重连后,从中间续接
 */
export async function getStream(sessionId: string, hourId: string): Promise<string | null> {
  const key = `syncro:stream:${sessionId}:${hourId}`;

  try {
    const value = await kv.get<string>(key);
    return value || null;
  } catch (e) {
    console.warn("[syncro-kv] getStream failed:", e);
    return null;
  }
}

/**
 * 清除流缓冲
 * 当 LLM 完成并写入 output 后,主动清 stream(节省空间)
 */
export async function clearStream(sessionId: string, hourId: string): Promise<void> {
  const key = `syncro:stream:${sessionId}:${hourId}`;

  try {
    await kv.del(key);
  } catch (e) {
    console.warn("[syncro-kv] clearStream failed:", e);
  }
}
