from pathlib import Path
import re
for p in Path("scripts").glob("test-m1*.ts"):
    t = p.read_text(encoding="utf-8")
    for i,line in enumerate(t.splitlines(),1):
        if "deterministic_m" in line or "ANSWER_INTERPRETATION" in line or "interpreter" in line:
            print(f"{p.name}:{i}|{line.strip()[:140]}")
