from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\answer-interpretation-model.ts")
t = p.read_text(encoding="utf-8")
lines = t.splitlines()
# print around 212
for i,l in enumerate(lines[200:240], start=201):
    print(f"{i}:{l}")
