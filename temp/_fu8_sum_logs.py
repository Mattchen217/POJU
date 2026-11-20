from pathlib import Path
import re
files = {
  "m1adaptive": r"C:\Users\13306\agent-tools\7a0d38c5-4458-4f17-bfa0-52c8e0e55780.txt",
  "m1r": "temp/out_m24r2fu8_final_m1r.txt",
  "m23": "temp/out_m24r2fu8_final_m23.txt",
  "m21": "temp/out_m24r2fu8_final_m21.txt",
  "m22": "temp/out_m24r2fu8_final_m22.txt",
  "phase2": "temp/out_m24r2fu8_final_phase2.txt",
  "typegen": "temp/out_m24r2fu8_final_typegen.txt",
  "tsc": "temp/out_m24r2fu8_final_tsc.txt",
  "build": "temp/out_m24r2fu8_final_build.txt",
}
for name, path in files.items():
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    # find summary-like lines
    keys = []
    for l in lines:
        if re.search(r"PASS=|FAIL=|passed|failed|tests? |✓|ok |Compiled|error TS|Creating an optimized|Route \(|✓ Compiled|Collecting page data|Linting and checking|error|exit", l, re.I):
            if "node_modules" in l: continue
            if len(l) > 240: continue
            keys.append(l.strip())
    print("="*20, name, "lines", len(lines), "="*20)
    # print last 25 lines and unique key lines
    print("KEY:")
    for l in keys[-20:]:
        print(" ", l)
    print("TAIL:")
    for l in lines[-15:]:
        print(" ", l)
    print()
