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

  /**
   * Token-checked compare-and-delete (atomic in-process).
   * Value may be a claim record `{ token }` or a bare token string.
   */
  async compareAndDelete(key: string, expectedToken: string): Promise<boolean> {
    const hit = this.store.get(key);
    if (!hit) return false;
    if (hit.expiresAt != null && hit.expiresAt <= now()) {
      this.store.delete(key);
      return false;
    }
    const value = hit.value;
    let token: string | null = null;
    if (typeof value === "string") token = value;
    else if (
      value &&
      typeof value === "object" &&
      typeof (value as { token?: unknown }).token === "string"
    ) {
      token = (value as { token: string }).token;
    }
    if (!token || token !== expectedToken) return false;
    this.store.delete(key);
    this.lists.delete(key);
    return true;
  }

  /**
   * M2.2-R5 — Atomic compare-and-set by exact JSON snapshot of current value.
   * `expectedJson === null` means the key must be absent (or expired).
   * No await between check and write → atomic for in-process concurrent workers.
   */
  async compareAndSetExact(
    key: string,
    expectedJson: string | null,
    nextValue: unknown,
    opts?: { ex?: number },
  ): Promise<boolean> {
    const hit = this.store.get(key);
    const live =
      hit && (hit.expiresAt == null || hit.expiresAt > now()) ? hit : null;
    if (expectedJson === null) {
      if (live) return false;
    } else {
      if (!live) return false;
      if (JSON.stringify(live.value) !== expectedJson) return false;
    }
    const expiresAt =
      opts?.ex != null && opts.ex > 0 ? now() + opts.ex * 1000 : null;
    this.store.set(key, { value: nextValue, expiresAt });
    return true;
  }

  /**
   * M2.2-R5 — Atomic job write gated on execution_generation.
   * Refuses when missing, generation mismatch, or revoked failure_reason.
   */
  async compareAndSetJobGeneration(
    key: string,
    expectedGeneration: number,
    nextValue: unknown,
    opts?: { ex?: number },
  ): Promise<boolean> {
    const hit = this.store.get(key);
    if (!hit) return false;
    if (hit.expiresAt != null && hit.expiresAt <= now()) {
      this.store.delete(key);
      return false;
    }
    const cur = hit.value;
    if (!cur || typeof cur !== "object") return false;
    const job = cur as {
      execution_generation?: unknown;
      failure_reason?: unknown;
      status?: unknown;
    };
    if (job.execution_generation !== expectedGeneration) return false;
    const reason = job.failure_reason;
    if (
      reason === "superseded_by_regenerate" ||
      reason === "superseded_by_deploy" ||
      reason === "user_cancelled"
    ) {
      return false;
    }
    // Stale worker must never flip a terminal job owned by a newer generation.
    if (job.status === "completed" || job.status === "failed") {
      const nextStatus =
        nextValue && typeof nextValue === "object"
          ? (nextValue as { status?: unknown }).status
          : undefined;
      if (nextStatus !== job.status) return false;
    }
    const expiresAt =
      opts?.ex != null && opts.ex > 0 ? now() + opts.ex * 1000 : null;
    this.store.set(key, { value: nextValue, expiresAt });
    return true;
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
