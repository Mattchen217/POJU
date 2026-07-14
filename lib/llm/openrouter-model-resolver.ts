import {
  OPENROUTER_MAX_ATTEMPTS,
  OPENROUTER_RETRY_DELAYS_MS,
  OpenRouterProviderQueueError,
  isEmptyResponseError,
  isRetryableOpenRouterError,
  isTransientNoEndpoints404,
  parseOpenRouterErrorStatus,
} from "@/lib/llm/openrouter-retry";

export { isEmptyResponseError, MAX_EMPTY_CONTENT_RESEND } from "@/lib/llm/openrouter-retry";

/** Built-in fallbacks when OPENROUTER_MODEL env is unset. Keep at least one live slug on OpenRouter. */
export const OPENROUTER_MODEL_CANDIDATES_BUILTIN = [
  "deepseek/deepseek-v4-pro",
] as const;

/** Primary default (first built-in) — legacy alias for tests / logs. */
export const DEFAULT_OPENROUTER_MODEL = OPENROUTER_MODEL_CANDIDATES_BUILTIN[0];

/** Dead slug TTL before re-probing (supplier may restore endpoint). */
const DEAD_SLUG_TTL_MS = 5 * 60 * 1000;

let preferredModel: string | null = null;
const deadUntil = new Map<string, number>();

/** Env + built-in candidates (deduped, env first). */
export function buildOpenRouterModelCandidatePool(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (slug?: string | null) => {
    const t = slug?.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  add(process.env.OPENROUTER_MODEL);
  for (const c of OPENROUTER_MODEL_CANDIDATES_BUILTIN) add(c);
  return out;
}

function isSlugAlive(slug: string, now = Date.now()): boolean {
  const until = deadUntil.get(slug);
  return until == null || until <= now;
}

/** Ordered slugs for this request — preferred first, skip dead (until TTL). */
export function resolveOpenRouterCandidateOrder(): string[] {
  const now = Date.now();
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (slug?: string | null) => {
    const t = slug?.trim();
    if (!t || seen.has(t) || !isSlugAlive(t, now)) return;
    seen.add(t);
    out.push(t);
  };
  add(preferredModel);
  add(process.env.OPENROUTER_MODEL);
  for (const c of OPENROUTER_MODEL_CANDIDATES_BUILTIN) add(c);
  return out.length > 0 ? out : [...OPENROUTER_MODEL_CANDIDATES_BUILTIN];
}

export function getOpenRouterPreferredModel(): string | null {
  return preferredModel;
}

export function markOpenRouterSlugPreferred(slug: string): void {
  const t = slug.trim();
  if (!t) return;
  preferredModel = t;
  deadUntil.delete(t);
}

export function markOpenRouterSlugDead(slug: string, ttlMs = DEAD_SLUG_TTL_MS): void {
  const t = slug.trim();
  if (!t) return;
  deadUntil.set(t, Date.now() + ttlMs);
  if (preferredModel === t) preferredModel = null;
}

/** True when OpenRouter reports a bad model slug (not transient provider endpoint outage). */
export function isOpenRouterModelNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (isTransientNoEndpoints404(err)) return false;
  const msg = err.message;
  const lower = msg.toLowerCase();
  if (lower.includes("model not found")) return true;
  if (msg.includes("找不到") && msg.includes("端点")) return false;
  if (lower.includes("does not exist") && lower.includes("model")) return true;
  const status = parseOpenRouterErrorStatus(msg);
  if (status === 404) {
    return (
      lower.includes("model not found") ||
      (lower.includes("does not exist") && lower.includes("model"))
    );
  }
  return false;
}

export function isOpenRouterModelNotFoundHttpStatus(status: number, body = ""): boolean {
  if (status !== 404) return false;
  const lower = body.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("quota")) return false;
  if (
    lower.includes("no endpoints") ||
    lower.includes("no endpoint found") ||
    lower.includes("no allowed providers")
  ) {
    return false;
  }
  return (
    lower.includes("model not found") ||
    lower.includes("does not exist") ||
    body.includes("找不到")
  );
}

/** Best-effort slug for logging / metadata — first candidate in resolve order. */
export function getOpenRouterDefaultModel(): string {
  return resolveOpenRouterCandidateOrder()[0] ?? DEFAULT_OPENROUTER_MODEL;
}

export type OpenRouterModelFallbackMeta = {
  model_used: string;
  fallback_path: string[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Try candidates in order; retry retryable errors up to maxAttempts per slug;
 * on true model-not-found 404, degrade to next slug immediately;
 * on transient No-endpoints 404, retry same slug (Streamlake) then next candidate.
 */
export async function callWithOpenRouterModelFallback<T>(
  makeCall: (model: string) => Promise<T>,
  options?: { maxAttempts?: number },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? OPENROUTER_MAX_ATTEMPTS;
  const candidates = resolveOpenRouterCandidateOrder();
  if (candidates.length === 0) {
    throw new Error("openrouter_no_model_candidates");
  }

  let lastErr: unknown;
  const tried: string[] = [];
  let sawRetryableExhaustion = false;

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i]!;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await makeCall(model);
        markOpenRouterSlugPreferred(model);
        if (tried.length > 0) {
          console.warn(
            `[openrouter] model fallback succeeded: ${tried.join(" → ")} → ${model}`,
          );
        }
        return result;
      } catch (e) {
        lastErr = e;

        // Empty content / empty body: Fix1 already same-param resent inside the call.
        // Never markSlugDead / never switch candidates / never report "全部 slug 失效".
        if (isEmptyResponseError(e)) {
          console.warn(
            `[openrouter] empty response after same-param resends (model=${model}) — not a slug failure`,
          );
          throw e;
        }

        if (isOpenRouterModelNotFoundError(e)) {
          tried.push(model);
          markOpenRouterSlugDead(model);
          const next = candidates[i + 1];
          console.warn(
            `[openrouter] slug 失效，降级下一个: ${model}${next ? ` → ${next}` : " (无更多候选)"}`,
          );
          break;
        }

        // Transient No-endpoints: retry same slug with backoff (not a dead slug yet).
        const canRetry = attempt < maxAttempts - 1 && isRetryableOpenRouterError(e);
        if (canRetry) {
          const wait_ms = OPENROUTER_RETRY_DELAYS_MS[attempt] ?? 6000;
          const kind = isTransientNoEndpoints404(e) ? "no-endpoints" : "retryable";
          console.warn(
            `[openrouter] retry model=${model} kind=${kind} attempt=${attempt + 1}/${maxAttempts - 1} wait_ms=${wait_ms}`,
          );
          await sleep(wait_ms);
          continue;
        }

        if (isRetryableOpenRouterError(e)) {
          sawRetryableExhaustion = true;
          tried.push(model);
          // Prefer next candidate (if any) after this slug's backoff budget is spent.
          if (isTransientNoEndpoints404(e)) {
            markOpenRouterSlugDead(model);
            const next = candidates[i + 1];
            console.warn(
              `[openrouter] 404 no-endpoints — 同 slug 重试耗尽，切换候选: ${model}${next ? ` → ${next}` : " (无更多候选)"}`,
            );
            break;
          }
          throw new OpenRouterProviderQueueError();
        }

        throw e;
      }
    }
  }

  if (sawRetryableExhaustion || isRetryableOpenRouterError(lastErr)) {
    console.warn(
      `[openrouter] 全部候选在重试后仍忙（已试: ${tried.join(" → ") || candidates.join(" → ")}）— 视为 provider queue。`,
    );
    throw new OpenRouterProviderQueueError();
  }

  console.error(
    `[openrouter] 全部 model slug 候选失效（已试: ${tried.join(" → ")}）。` +
      "请在 OpenRouter dashboard 确认可用 slug，并设置 OPENROUTER_MODEL 或更新 OPENROUTER_MODEL_CANDIDATES_BUILTIN。",
  );
  throw lastErr instanceof Error ? lastErr : new Error("openrouter_all_model_slugs_failed");
}

/** Alias — retry per slug + 404 candidate fallback (Block 67/69). */
export const callWithRetryAndFallback = callWithOpenRouterModelFallback;

/** Test-only reset. */
export function resetOpenRouterModelResolverForTests(): void {
  preferredModel = null;
  deadUntil.clear();
}
