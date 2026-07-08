/**
 * OpenRouter model slug resolver — multi-candidate + 404 auto-fallback + preferred cache.
 * All chat/stream requests should use {@link callWithOpenRouterModelFallback}.
 */

/** Built-in fallbacks when OPENROUTER_MODEL env is unset. Keep at least one live slug on OpenRouter. */
export const OPENROUTER_MODEL_CANDIDATES_BUILTIN = [
  "deepseek/deepseek-v4-pro-20260423",
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

/** True when OpenRouter reports missing model / endpoint (404 or equivalent body). */
export function isOpenRouterModelNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  if (/openrouter_(http|stream)_404\b/.test(msg)) return true;
  const lower = msg.toLowerCase();
  if (lower.includes("no endpoint") || lower.includes("model not found")) return true;
  if (msg.includes("找不到") && msg.includes("端点")) return true;
  if (lower.includes("does not exist") && lower.includes("model")) return true;
  return false;
}

export function isOpenRouterModelNotFoundHttpStatus(status: number, body = ""): boolean {
  if (status !== 404) return false;
  const lower = body.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("quota")) return false;
  return (
    lower.includes("no endpoint") ||
    lower.includes("model not found") ||
    lower.includes("does not exist") ||
    lower.includes("not found") ||
    body.includes("找不到") ||
    body.length === 0
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

/**
 * Try candidates in order; on model-not-found 404, degrade to next slug.
 * Non-404 errors propagate immediately.
 */
export async function callWithOpenRouterModelFallback<T>(
  makeCall: (model: string) => Promise<T>,
): Promise<T> {
  const candidates = resolveOpenRouterCandidateOrder();
  if (candidates.length === 0) {
    throw new Error("openrouter_no_model_candidates");
  }

  let lastErr: unknown;
  const tried: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i]!;
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
      if (isOpenRouterModelNotFoundError(e)) {
        tried.push(model);
        markOpenRouterSlugDead(model);
        const next = candidates[i + 1];
        console.warn(
          `[openrouter] slug 失效，降级下一个: ${model}${next ? ` → ${next}` : " (无更多候选)"}`,
        );
        lastErr = e;
        continue;
      }
      throw e;
    }
  }

  console.error(
    `[openrouter] 全部 model slug 候选失效（已试: ${tried.join(" → ")}）。` +
      "请在 OpenRouter dashboard 确认可用 slug，并设置 OPENROUTER_MODEL 或更新 OPENROUTER_MODEL_CANDIDATES_BUILTIN。",
  );
  throw lastErr instanceof Error ? lastErr : new Error("openrouter_all_model_slugs_failed");
}

/** Test-only reset. */
export function resetOpenRouterModelResolverForTests(): void {
  preferredModel = null;
  deadUntil.clear();
}
