import sys, os
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
os.chdir(r"D:\POJU\pojulife")
s = Path("temp/out_m24r2fu3_final_summary.txt")
print("SUMMARY exists", s.exists())
if s.exists():
    print(s.read_text(encoding="utf-8", errors="replace"))
tsc = Path("temp/out_m24r2fu3_final_tsc.txt")
print("---- TSC ----")
if tsc.exists():
    print(tsc.read_text(encoding="utf-8", errors="replace")[-12000:])
else:
    print("missing")
b = Path("temp/out_m24r2fu3_final_build.txt")
print("---- BUILD exists", b.exists(), "size", b.stat().st_size if b.exists() else 0)
# check if python regress still running
