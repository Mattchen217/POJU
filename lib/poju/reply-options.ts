import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";

/** Pull user-facing option text; never String(object) → "[object Object]". */
function extractOptionText(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    for (const k of ["text", "label", "option", "content", "value", "title"]) {
      if (typeof o[k] === "string" && o[k].trim()) return (o[k] as string).trim();
    }
    for (const v of Object.values(o)) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "";
}

/** 2–3 reply chips; <2 or non-array → undefined (progressive fallback to plain composer). */
export function sanitizeReplyOptions(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .map(extractOptionText)
    .filter((s) => s.length > 0 && s !== "[object Object]");
  return out.length >= 2 ? out.slice(0, 3) : undefined;
}

/** Hide chips in UI after the user replies; keep option texts for pick detection. */
export function consumeReplyOptionsOnSession(session: POJUSessionState): POJUSessionState {
  let changed = false;
  const messages = session.messages.map((m) => {
    if (m.role !== "assistant" || !m.options?.length) return m;
    if (m.meta?.options_consumed) return m;
    changed = true;
    // 【关键】勿删 options：clamp/userPickedProvidedOption 靠全文等匹配点选。
    // UI 用 options_consumed 隐藏芯片；删掉会导致点选永远判不成 satisfied。
    const offered = m.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0);
    return {
      ...m,
      meta: {
        ...m.meta,
        options_consumed: true,
        offered_options: offered.length >= 2 ? offered : m.meta?.offered_options,
      },
    };
  });
  return changed ? { ...session, messages } : session;
}
