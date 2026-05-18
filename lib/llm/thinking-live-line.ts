/** Pick the latest line for single-line “live thinking” UI. */
export function reasoningToLiveLine(full: string): string {
  const trimmed = full.trim();
  if (!trimmed) return "";

  const lines = trimmed.split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length > 0) {
    const last = lines[lines.length - 1];
    return last.length > 240 ? `…${last.slice(-240)}` : last;
  }

  const oneLine = trimmed.replace(/\s+/g, " ");
  return oneLine.length > 240 ? `…${oneLine.slice(-240)}` : oneLine;
}
