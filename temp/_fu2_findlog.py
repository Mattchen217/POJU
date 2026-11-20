from pathlib import Path
t = Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8")
for i,l in enumerate(t.splitlines(),1):
    if "m24r2fu2b" in l and "next_q" in l:
        print(i, repr(l[:400]))
