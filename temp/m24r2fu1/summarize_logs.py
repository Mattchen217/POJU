from pathlib import Path
import re
files = list(Path("temp").glob("out_m24r2fu1_*.txt"))
for p in sorted(files):
    t = p.read_text(encoding="utf-8", errors="replace")
    hits = []
    for ln in t.splitlines():
        if re.search(r"PASS=|FAIL=|tests? passed|Test Files|EXIT=", ln, re.I):
            if "pojuTerm" in ln:
                continue
            hits.append("".join(ch if ord(ch) < 128 else "?" for ch in ln)[:240])
    if hits:
        print("==", p.name)
        for h in hits[-12:]:
            print(" ", h)
