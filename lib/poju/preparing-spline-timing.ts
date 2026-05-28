/** Wider camera so the circular analyzing particles fit on mobile without square clipping. */
export const PREPARING_ANALYZING_ZOOM = 0.52;

/** Minimum Spline analyzing scene duration (fresh LLM base analysis). */
export const PREPARING_MIN_SPLINE_MS = 5000;

/** Cached profile — show analyzing scene longer so it does not flash past. */
export const PREPARING_MIN_SPLINE_CACHE_MS = 10_000;

export async function waitRemainingMinSpline(startedAt: number, minMs: number): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((r) => setTimeout(r, remaining));
  }
}
