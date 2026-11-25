/**
 * Injectable wall clock for lease boundary tests (MemoryKv).
 * Redis Lua uses redis.call("TIME").
 */

let nowMsOverride: number | null = null;

export function setBatch3NowMsForTests(ms: number | null): void {
  nowMsOverride = ms;
}

export function batch3NowMs(): number {
  return nowMsOverride ?? Date.now();
}

export function batch3NowIso(): string {
  return new Date(batch3NowMs()).toISOString();
}
