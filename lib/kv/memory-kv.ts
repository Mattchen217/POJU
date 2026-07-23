/**
 * Process-local KV for local dev when Upstash / Vercel KV env is absent.
 * Not shared across processes — fine for `pnpm dev` base-analysis locks/jobs.
 */

type Entry = {
  value: unknown;
  expiresAt: number | null;
};

function now(): number {
  return Date.now();
}

export function isRemoteKvConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
      process.env.KV_REST_API_URL?.trim() ||
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
      process.env.KV_REST_API_TOKEN?.trim(),
  );
}

export class MemoryKv {
  private store = new Map<string, Entry>();
  private lists = new Map<string, unknown[]>();

  private read(key: string): unknown | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt != null && hit.expiresAt <= now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.read(key) as T | null) ?? null;
  }

  async set(
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean },
  ): Promise<"OK" | null> {
    if (opts?.nx && this.read(key) != null) {
      return null;
    }
    const expiresAt =
      opts?.ex != null && opts.ex > 0 ? now() + opts.ex * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const key of keys) {
      if (this.store.delete(key) || this.lists.delete(key)) n += 1;
    }
    return n;
  }

  async lpush(key: string, ...values: unknown[]): Promise<number> {
    const list = this.lists.get(key) ?? [];
    for (const v of values) list.unshift(v);
    this.lists.set(key, list);
    return list.length;
  }

  async ltrim(key: string, start: number, stop: number): Promise<"OK"> {
    const list = this.lists.get(key) ?? [];
    const end = stop < 0 ? list.length + stop + 1 : stop + 1;
    this.lists.set(key, list.slice(start, Math.max(start, end)));
    return "OK";
  }

  async lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]> {
    const list = this.lists.get(key) ?? [];
    const end = stop < 0 ? list.length + stop + 1 : stop + 1;
    return list.slice(start, Math.max(start, end)) as T[];
  }

  async expire(key: string, seconds: number): Promise<number> {
    const hit = this.store.get(key);
    if (hit) {
      hit.expiresAt = now() + seconds * 1000;
      return 1;
    }
    if (this.lists.has(key)) {
      /* list TTL not tracked separately — accept for local */
      return 1;
    }
    return 0;
  }
}
