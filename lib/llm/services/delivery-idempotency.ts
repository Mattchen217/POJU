/**
 * Short-TTL server-side idempotency for paid delivery routes (same-instance retries).
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  expires_at: number;
  payload: unknown;
};

const successCache = new Map<string, CacheEntry>();

function prune(now: number) {
  for (const [key, entry] of successCache) {
    if (entry.expires_at <= now) successCache.delete(key);
  }
}

export function getCachedDelivery<T>(key: string): T | null {
  const now = Date.now();
  prune(now);
  const hit = successCache.get(key);
  if (!hit || hit.expires_at <= now) return null;
  return hit.payload as T;
}

export function setCachedDelivery(key: string, payload: unknown, ttlMs = DEFAULT_TTL_MS): void {
  successCache.set(key, { expires_at: Date.now() + ttlMs, payload });
}

export async function withDeliveryIdempotency<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const cached = getCachedDelivery<T>(key);
  if (cached != null) {
    console.info("[delivery-idempotency] cache hit:", key);
    return cached;
  }
  const value = await fn();
  setCachedDelivery(key, value, ttlMs);
  return value;
}

export function fingerprintText(input: string): string {
  let hash = 0;
  const s = input.trim();
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
