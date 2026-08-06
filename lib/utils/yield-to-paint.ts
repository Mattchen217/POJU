/**
 * Yield until the browser has painted (two animation frames).
 * Use after optimistic UI updates so heavy sync work (JSON.stringify, IDB)
 * does not starve the user-message bubble.
 */
export function yieldToBrowserPaint(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}
