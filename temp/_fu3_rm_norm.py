from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\answer-interpretation-model.ts")
text = p.read_text(encoding="utf-8")
old = '''
function normalizeComparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s，,。．.!！？?；;、]/g, "")
    .trim();
}

'''
assert old in text
p.write_text(text.replace(old, "\n"), encoding="utf-8", newline="\n")
print("removed unused normalizeComparable")
