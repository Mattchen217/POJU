/** Day-of-year progress through the current calendar year (0–100). */
export function computeYearTransitProgress(now = new Date()): number {
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const totalDays = now.getFullYear() % 4 === 0 ? 366 : 365;
  return Math.min(100, Math.max(0, Math.round((dayOfYear / totalDays) * 100)));
}
