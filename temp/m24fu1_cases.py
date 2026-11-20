from pathlib import Path
t = Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8")
print("lines", len(t.splitlines()))
# find Case G and Case H sections
for label in ["Case G", "Case H", "Case A", "M2.4", "m24g", "m24h", "caseG", "caseH"]:
    idx = 0
    while True:
        i = t.find(label, idx)
        if i < 0: break
        line = t[:i].count("\n")+1
        print(f"FOUND {label} at line {line}")
        idx = i+1
