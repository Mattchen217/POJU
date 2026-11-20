from pathlib import Path

p = Path("lib/poju/decision-intake/conflict-clarification.ts")
text = p.read_text(encoding="utf-8")

old = '''function compactChoiceText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\\s,，。．.!！？?、；;:："'"'""''“”‘’()（）[\\]【】…—–-]/g, "")
    .trim();
}'''

# Use a safer punctuation strip without broken quote nesting.
new = '''function compactChoiceText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\\s\\p{P}\\p{S}]+/gu, "")
    .trim();
}'''

if old not in text:
    # Fallback: locate by function name and rewrite the body.
    import re
    pat = re.compile(
        r"function compactChoiceText\(text: string\): string \{\n"
        r"  return text\n"
        r"    \.toLowerCase\(\)\n"
        r"    \.replace\(/.*?/g, \"\"\)\n"
        r"    \.trim\(\);\n"
        r"\}",
        re.S,
    )
    m = pat.search(text)
    if not m:
        raise SystemExit("compactChoiceText not found for rewrite")
    text = text[: m.start()] + new + text[m.end() :]
else:
    text = text.replace(old, new, 1)

p.write_text(text, encoding="utf-8", newline="\n")
print("fixed compactChoiceText")
print(p.read_text(encoding="utf-8").split("function compactChoiceText")[1][:220])