from pathlib import Path

# Remove unused roleCodesToRoles
p = Path("lib/poju/decision-intake/answer-interpretation.ts")
text = p.read_text(encoding="utf-8")
old = '''function roleCodesToRoles(codes: string[] | undefined | null): string[] {
  if (!codes || codes.length === 0) return [];
  return codes
    .map((c) => {
      const m = /\\/role\\/([^/]+)$/.exec(c);
      return m?.[1] ?? "";
    })
    .filter(Boolean);
}

'''
if old not in text:
    raise SystemExit("roleCodesToRoles not found")
p.write_text(text.replace(old, "", 1), encoding="utf-8", newline="\n")
print("removed roleCodesToRoles")

# Remove unused AnswerClass import
p2 = Path("lib/poju/decision-intake/pending-answer-resolution.ts")
t2 = p2.read_text(encoding="utf-8")
t2 = t2.replace("  AnswerClass,\n", "")
p2.write_text(t2, encoding="utf-8", newline="\n")
print("removed AnswerClass import")

# Fix test regex
p3 = Path("scripts/test-m1-production-adaptive-question-loop.ts")
t3 = p3.read_text(encoding="utf-8")
t3 = t3.replace("asst.content.replace(/\\\\n/g, \" / \")", "asst.content.replace(/\\n/g, \" / \")")
# depending on file content...
if "replace(/\\\\n/g" in t3:
    t3 = t3.replace("replace(/\\\\n/g", "replace(/\\n/g")
    print("fixed double-escaped regex")
elif "replace(/\\n/g" in t3:
    print("already single escaped in python read - check raw")
# Show the actual snippet
idx = t3.find("next_q=${asst.content")
print(repr(t3[idx:idx+80]))
p3.write_text(t3, encoding="utf-8", newline="\n")
