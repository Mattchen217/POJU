from pathlib import Path
p = Path(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts")
text = p.read_text(encoding="utf-8")
old = 'const tooLong = `${"我目前月薪三万。".repeat(200)}x`;'
new = 'const tooLong = `${"x".repeat(2001)}`;'
assert old in text, "tooLong line not found"
text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("fixed tooLong")