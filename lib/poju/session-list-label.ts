/** Default title for a new POJU session before the user sends a first message. */
export const DEFAULT_NEW_SESSION_TITLE = "I'd like to begin a POJU session.";

export function sessionListTopicLine(original_question: string): string {
  const q = original_question?.trim() || "";
  if (!q || q === DEFAULT_NEW_SESSION_TITLE) return "New session";
  if (q.length > 48) return `${q.slice(0, 45)}…`;
  return q;
}

export function formatSessionListDateTime(d: Date | string, locale: string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const tag = locale.replace(/_/g, "-");
  const timeZone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  try {
    return new Intl.DateTimeFormat(tag, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
}

/** Same primary line as the session list row: `{date} · {topic}`. */
export function formatSessionListPrimaryLine(
  createdAt: Date | string,
  original_question: string,
  locale: string,
): string {
  return `${formatSessionListDateTime(createdAt, locale)} · ${sessionListTopicLine(original_question)}`;
}
