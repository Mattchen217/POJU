/**
 * Normalize agenda label/id for loose matching (trim, collapse space, strip quotes).
 */
export function normalizeAgendaRef(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[「」『』""''`]/g, "");
}

/**
 * Label slices that show up in almost any question (情况/态度/时间…).
 * A hit that is only one of these does not prove which item was asked.
 */
const GENERIC_LABEL_HITS = new Set([
  "情况",
  "态度",
  "模式",
  "自己",
  "对方",
  "你对",
  "近期",
  "实际",
  "空间",
  "项目",
  "什么",
  "怎么",
  "是否",
  "分配",
]);

export type AskedAgendaResolution = {
  target: { id: string; label: string; status?: string } | null;
  /** Last assistant ask clearly names a different agenda item than the cursor. */
  off_focus: boolean;
  /** Write the user reply onto `target` (pending item, or a strong re-ask of a covered one). */
  capture: boolean;
  /** Mark `target` covered. False when the ask only re-hit an already covered item. */
  cover: boolean;
};

function longestDistinctLabelHit(
  label: string,
  askedHan: string,
): { len: number } {
  const lab = label.replace(/[^\u4e00-\u9fff]/g, "");
  const max = Math.min(lab.length, 12);
  for (let len = max; len >= 2; len--) {
    for (let i = 0; i + len <= lab.length; i++) {
      const slice = lab.slice(i, i + len);
      if (GENERIC_LABEL_HITS.has(slice)) continue;
      if (askedHan.includes(slice)) return { len };
    }
  }
  return { len: 0 };
}

/**
 * Bind a collecting reply to the agenda item the assistant actually asked,
 * not the cursor. Paraphrases with no distinctive overlap stay on the cursor.
 * A clear ask about another item must not be filed onto the cursor.
 */
export function resolveAskedAgendaItem(
  agenda: readonly { id: string; label: string; status?: string }[],
  lastAsked: string,
  focus: { id: string; label: string } | null,
): AskedAgendaResolution {
  const focusItem =
    agenda.find((a) => a.id === focus?.id || a.label === focus?.label) ?? null;
  const onFocus: AskedAgendaResolution = {
    target: focusItem,
    off_focus: false,
    capture: true,
    cover: true,
  };
  if (!focus || !lastAsked.trim() || agenda.length === 0) return onFocus;

  const askedHan = lastAsked.replace(/[^\u4e00-\u9fff]/g, "");
  if (askedHan.length < 2) return onFocus;

  const scored = agenda.map((a) => ({
    a,
    len: longestDistinctLabelHit(a.label, askedHan).len,
  }));
  scored.sort((x, y) => y.len - x.len || agenda.indexOf(x.a) - agenda.indexOf(y.a));
  const top = scored[0];
  const second = scored[1];
  const focusScore =
    scored.find((s) => s.a.id === focus.id || s.a.label === focus.label)?.len ?? 0;

  if (!top || top.len < 2) return onFocus;
  const tied =
    Boolean(second) &&
    second!.len === top.len &&
    top.a.id !== focus.id &&
    top.a.label !== focus.label;
  if (tied && top.len < 4) return onFocus;
  if (top.a.id === focus.id || top.a.label === focus.label || top.len <= focusScore) {
    return onFocus;
  }

  const covered = top.a.status === "covered";
  return {
    target: top.a,
    off_focus: true,
    capture: !covered || top.len >= 4,
    cover: !covered,
  };
}

/**
 * Whether model-reported completed_in_this_turn hits the current focus.
 * Accepts exact label, exact id, or containment when either side is long enough.
 */
export function agendaReportMatchesFocus(
  reported: readonly string[] | null | undefined,
  focus: { id: string; label: string } | null | undefined,
): boolean {
  if (!focus || !reported?.length) return false;
  const labelN = normalizeAgendaRef(focus.label);
  const idN = normalizeAgendaRef(focus.id);
  if (!labelN && !idN) return false;

  for (const raw of reported) {
    if (typeof raw !== "string") continue;
    const n = normalizeAgendaRef(raw);
    if (!n) continue;
    if (labelN && n === labelN) return true;
    if (idN && n === idN) return true;
    if (labelN.length >= 4 && (n.includes(labelN) || labelN.includes(n))) return true;
    if (idN.length >= 2 && (n === idN || n.includes(idN) || idN.includes(n))) return true;
  }
  return false;
}
