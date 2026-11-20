from pathlib import Path
p = Path(r"D:\POJU\pojulife\scripts\fixtures\test-answer-interpretation-hook.ts")
print(p.read_text(encoding="utf-8") if p.exists() else "MISSING")
