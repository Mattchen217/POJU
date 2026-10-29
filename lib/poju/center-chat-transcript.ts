/**
 * Center chat is stages 1–3 only.
 * Stage 4 (decision report) is stored on the session for the vault flip-book,
 * and must not render as a long bubble.
 */

export function isCenterChatReportDump(message: {
  role: string;
  content?: string | null;
  meta?: { contains_delivery?: boolean } | null;
}): boolean {
  if (message.role !== "assistant") return false;
  if (message.meta?.contains_delivery) return true;
  const text = (message.content ?? "").trim();
  if (text.length < 400 || !text.startsWith("#")) return false;
  return (
    /Energy Decision Report|能量决策报告|Informe de decisión energética|Rapport de décision énergétique/i.test(
      text,
    ) || /```poju-page-schema/i.test(text)
  );
}
