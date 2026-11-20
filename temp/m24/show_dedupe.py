from pathlib import Path
p = Path(r"lib/poju/decision-intake/question-generation.ts")
t = p.read_text(encoding="utf-8")
old = '''function normalizeQ(text: string): string {
  return text.toLowerCase().replace(/[\\s，,。．.!！？?；;：:、？]/g, "");
}

function isSubstantialDuplicate(
  candidate: string,
  prior: string | null | undefined,
): boolean {
  if (!prior) return false;
  const a = normalizeQ(candidate);
  const b = normalizeQ(prior);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 8 && b.includes(a.slice(0, Math.min(16, a.length)))) return true;
  if (b.length >= 8 && a.includes(b.slice(0, Math.min(16, b.length)))) return true;
  return false;
}'''
# Read actual current block
i = t.find('function normalizeQ')
print('at', i)
print(repr(t[i:i+450]))
