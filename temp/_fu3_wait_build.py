import sys, time
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
# wait a bit and report
for i in range(12):
    s = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_summary.txt")
    b = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_build.txt")
    print(f"t={i*10}s summary={s.exists()} build_size={b.stat().st_size if b.exists() else 0}")
    if s.exists():
        print(s.read_text(encoding="utf-8", errors="replace"))
        break
    time.sleep(10)
else:
    # tail build
    t = b.read_text(encoding="utf-8", errors="replace") if b.exists() else ""
    print("BUILD TAIL:")
    print(t[-2000:])
