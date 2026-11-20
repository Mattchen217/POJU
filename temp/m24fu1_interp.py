from pathlib import Path
p = Path("lib/poju/decision-intake/types.ts")
t = p.read_text(encoding="utf-8")
# find interpreter field
for i,line in enumerate(t.splitlines(),1):
    if "interpreter" in line:
        print(f"{i}|{line}")
