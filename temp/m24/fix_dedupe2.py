from pathlib import Path
p = Path(r"lib/poju/decision-intake/question-generation.ts")
t = p.read_text(encoding="utf-8")
start = t.find("function normalizeQ")
end = t.find("function composeQuestion", start)
assert start >= 0 and end > start, (start, end)
new = """function normalizeQ(text: string): string {
  return text.toLowerCase().replace(/[\\s，,。．.!！？?；;：:、？]/g, \"\");
}

/** Strip shared decision-question prefix so dedupe compares the ask focus. */
function focusKey(text: string): string {
  const n = normalizeQ(text);
  return n
    .replace(/^关于[^—\\-]+[—\\-]{1,2}/, \"\")
    .replace(/^about[^?？]{0,40}/, \"\");
}

function isSubstantialDuplicate(
  candidate: string,
  prior: string | null | undefined,
): boolean {
  if (!prior) return false;
  const a = focusKey(candidate);
  const b = focusKey(prior);
  if (!a || !b) return false;
  if (a === b) return true;
  const stemLen = 20;
  if (a.length >= stemLen && b.includes(a.slice(0, stemLen))) return true;
  if (b.length >= stemLen && a.includes(b.slice(0, stemLen))) return true;
  return false;
}

"""
p.write_text(t[:start] + new + t[end:], encoding="utf-8")
print("dedupe replaced ok", start, end)
