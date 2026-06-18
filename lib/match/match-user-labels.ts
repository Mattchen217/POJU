/** Match preview labels — user-facing copy must not use「命主」(payment-gateway restricted). */

export function matchUserDisplayLabel(person: "A" | "B", locale: string): string {
  const zh = locale.startsWith("zh");
  if (person === "A") return zh ? "用户A" : "User A";
  return zh ? "用户B" : "User B";
}

export function matchUserSubjectPrefix(person: "A" | "B", locale: string): string {
  const label = matchUserDisplayLabel(person, locale);
  return locale.startsWith("zh") ? `${label}：` : `${label}: `;
}

/** Strip legacy「命主 A/B」from LLM output if the model slips. */
export function sanitizeMatchUserLabels(text: string, locale: string): string {
  if (!text.trim()) return text;
  const a = matchUserDisplayLabel("A", locale);
  const b = matchUserDisplayLabel("B", locale);
  return text
    .replace(/命主\s*A/g, a)
    .replace(/命主\s*B/g, b)
    .replace(/命主A/g, a)
    .replace(/命主B/g, b);
}
