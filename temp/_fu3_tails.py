import sys,re
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
for name in [
    "temp/out_m24r2fu3_final_m23.txt",
    "temp/out_m24r2fu3_final_m21.txt",
    "temp/out_m24r2fu3_final_m22.txt",
    "temp/out_m24r2fu3_final_phase2.txt",
    "temp/out_m24r2fu3_final_typegen.txt",
    "temp/out_m24r2fu3_final_tsc.txt",
]:
    t=Path(r"D:\POJU\pojulife", name).read_text(encoding="utf-8", errors="replace")
    print(f"\n==== {name} ({len(t)} chars) ====")
    # print last 25 non-empty or pass/fail lines
    lines=[ln for ln in t.splitlines() if ln.strip()]
    for ln in lines[:8]:
        print(ln)
    print("...")
    for ln in lines[-20:]:
        print(ln)
