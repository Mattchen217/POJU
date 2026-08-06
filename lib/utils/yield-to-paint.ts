/**
 * Yield until the browser has painted (two animation frames),
 * then a macrotask so React commits / layout settle before heavy work.
 */
export function yieldToBrowserPaint(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    });
  });
}
