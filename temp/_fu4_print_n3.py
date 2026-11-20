from pathlib import Path
p = Path(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts")
lines = p.read_text(encoding="utf-8").splitlines()
out = Path(r"D:\POJU\pojulife\temp\_fu4_n3_body.txt")
chunk = "\n".join(f"{i:5d}|{l}" for i,l in enumerate(lines[5265:5385], 5266))
out.write_text(chunk, encoding="utf-8")
print("wrote", len(chunk))
