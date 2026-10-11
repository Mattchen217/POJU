/** Calendar day helpers for companion window (UTC date math on Y-M-D keys). */

export type Ymd = { year: number; month: number; day: number };

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDateKey(ymd: Ymd): string {
  return `${ymd.year}-${pad2(ymd.month)}-${pad2(ymd.day)}`;
}

export function parseDateKey(dateKey: string): Ymd {
  const [y, m, d] = dateKey.split("-").map((x) => Number(x));
  return { year: y!, month: m!, day: d! };
}

export function addDaysKey(dateKey: string, offset: number): string {
  const ymd = parseDateKey(dateKey);
  const dt = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + offset));
  return formatDateKey({
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  });
}

export function diffDaysKey(a: string, b: string): number {
  const A = parseDateKey(a);
  const B = parseDateKey(b);
  const ta = Date.UTC(A.year, A.month - 1, A.day);
  const tb = Date.UTC(B.year, B.month - 1, B.day);
  return Math.round((tb - ta) / 86_400_000);
}

export function startOfWeekSundayKey(dateKey: string): string {
  const ymd = parseDateKey(dateKey);
  const dt = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
  const dow = dt.getUTCDay();
  return addDaysKey(dateKey, -dow);
}
