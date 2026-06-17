/** Default title for a new POJU session before the user sends a first message. */
export const DEFAULT_NEW_SESSION_TITLE = "I'd like to begin a POJU session.";

export function isDefaultNewSessionTitle(question: string | undefined | null): boolean {
  const q = question?.trim() || "";
  return !q || q === DEFAULT_NEW_SESSION_TITLE;
}

export function topicFromFirstUserMessage(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("[Image attached:")) return "Image";
  if (t.startsWith("[PDF attached:")) return "PDF";
  if (t.startsWith("[Document attached:")) return "Document";
  const max = 72;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function resolveSessionListTopic(
  input: {
    original_question: string;
    pending_question?: string | null;
    first_user_message?: string | null;
  },
  newSessionLabel = "New session",
): string {
  const pending = input.pending_question?.trim();
  if (pending) {
    const fromPending = topicFromFirstUserMessage(pending);
    if (fromPending) return fromPending;
  }

  const original = input.original_question?.trim() || "";
  if (!isDefaultNewSessionTitle(original)) return original;

  const firstUser = input.first_user_message?.trim();
  if (firstUser) {
    const fromUser = topicFromFirstUserMessage(firstUser);
    if (fromUser) return fromUser;
  }

  return newSessionLabel;
}

export function sessionListTopicLine(
  original_question: string,
  newSessionLabel = "New session",
): string {
  return resolveSessionListTopic({ original_question }, newSessionLabel);
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
  newSessionLabel = "New session",
): string {
  return `${formatSessionListDateTime(createdAt, locale)} · ${sessionListTopicLine(original_question, newSessionLabel)}`;
}
