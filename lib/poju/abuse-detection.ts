const BLOCKED = [/kill\b/i, /suicide/i, /bomb/i, /诈骗|杀人|自杀/];

export function detectAbuse(input: string, totalChars: number): { blocked: boolean; reason?: string } {
  if (input.length > 4000 || totalChars > 80_000) {
    return { blocked: true, reason: "token_budget_exceeded" };
  }
  for (const rule of BLOCKED) {
    if (rule.test(input)) return { blocked: true, reason: "unsafe_content" };
  }
  return { blocked: false };
}
