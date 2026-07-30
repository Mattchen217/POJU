import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";

/** 2–3 reply chips; <2 or non-array → undefined (progressive fallback to plain composer). */
export function sanitizeReplyOptions(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const opts = raw
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter((s) => s.length > 0)
    .slice(0, 3);
  return opts.length >= 2 ? opts : undefined;
}

/** Clear options on assistant turns after the user replies (picked chip or free text). */
export function consumeReplyOptionsOnSession(session: POJUSessionState): POJUSessionState {
  let changed = false;
  const messages = session.messages.map((m) => {
    if (m.role !== "assistant" || !m.options?.length) return m;
    changed = true;
    const next: POJUMessage = { ...m, options: undefined };
    if (m.meta) {
      next.meta = { ...m.meta, options_consumed: true };
    } else {
      next.meta = { options_consumed: true };
    }
    return next;
  });
  return changed ? { ...session, messages } : session;
}
