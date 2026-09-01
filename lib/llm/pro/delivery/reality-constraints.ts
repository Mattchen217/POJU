/**
 * Compact collecting facts for Phase-4 page fill (Gate A).
 * Delivery-phase only — do not import into POJU_IDENTITY.
 */

export type CoveredAgendaItem = { label: string; answer?: string };

const DEFAULT_ANSWER_MAX = 160;
const DEFAULT_TOTAL_MAX = 1_800;

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Build a short hard-constraint block for fill user prompts.
 * Truncates per-answer and total size to protect soft-wall token budget.
 */
export function buildRealityConstraintsBlock(
  covered_agenda: readonly CoveredAgendaItem[] | null | undefined,
  opts?: {
    answerMaxChars?: number;
    totalMaxChars?: number;
    original_question?: string | null;
    desired_outcome?: string | null;
  },
): string {
  const answerMax = opts?.answerMaxChars ?? DEFAULT_ANSWER_MAX;
  const totalMax = opts?.totalMaxChars ?? DEFAULT_TOTAL_MAX;
  const lines: string[] = [
    "【本案硬约束·不得改写或编造相反事实】",
    "未出现的数字(缓冲月数等)禁止发明;赛道/身份词须与答案同向;冲突→废稿重写。",
  ];
  const q = opts?.original_question?.trim();
  if (q) lines.push(`问题: ${clip(q, answerMax)}`);
  const want = opts?.desired_outcome?.trim();
  if (want) lines.push(`期望: ${clip(want, answerMax)}`);

  const agenda = covered_agenda ?? [];
  for (const item of agenda) {
    const label = clip(item.label || "项", 80);
    const answer = item.answer?.trim();
    lines.push(answer ? `${label}: ${clip(answer, answerMax)}` : `${label}: (未捕获答案)`);
  }
  if (agenda.length === 0 && !q && !want) {
    lines.push("(无 covered_agenda — 禁止编造具体缓冲月数/未确认赛道细节)");
  }

  let out = lines.join("\n");
  if (out.length > totalMax) {
    out = `${out.slice(0, totalMax - 1)}…`;
  }
  return out;
}

/** Extract month-like numbers from agenda answers for soft conflict notes. */
export function extractAgendaMonthHints(
  covered_agenda: readonly CoveredAgendaItem[] | null | undefined,
): number[] {
  const months = new Set<number>();
  for (const item of covered_agenda ?? []) {
    const text = `${item.label} ${item.answer ?? ""}`;
    for (const m of text.matchAll(/(\d+)\s*[–\-~到至]?\s*(\d+)?\s*(个)?月/g)) {
      const a = Number(m[1]);
      const b = m[2] ? Number(m[2]) : a;
      if (Number.isFinite(a) && a > 0 && a <= 60) months.add(a);
      if (Number.isFinite(b) && b > 0 && b <= 60) months.add(b);
    }
    for (const m of text.matchAll(/(\d+)\s*-\s*(\d+)\s*months?/gi)) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (Number.isFinite(a) && a > 0 && a <= 60) months.add(a);
      if (Number.isFinite(b) && b > 0 && b <= 60) months.add(b);
    }
  }
  return [...months].sort((x, y) => x - y);
}

/**
 * Soft note when book prose invents a month count absent from agenda hints.
 * Does not fail the book — Gate A follow-up may harden later.
 */
export function noteAgendaMonthConflicts(
  bookText: string,
  agendaMonths: readonly number[],
): string[] {
  if (agendaMonths.length === 0) return [];
  const notes: string[] = [];
  const found = new Set<number>();
  for (const m of bookText.matchAll(/(\d+)\s*(个月|个月缓冲|个月现金|months?\s*(burn|cash|buffer|runway)?)/gi)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n <= 60) found.add(n);
  }
  for (const n of found) {
    if (!agendaMonths.includes(n)) {
      notes.push(`agenda_month_conflict:${n}`);
    }
  }
  return notes;
}
