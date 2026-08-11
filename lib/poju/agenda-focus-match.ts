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
