import sys, time, subprocess
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
# list node/pnpm python
try:
    out = subprocess.check_output('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', shell=True, text=True, errors="replace")
    print(out[:2000])
except Exception as e:
    print("tasklist err", e)
s = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_summary.txt")
b = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_build.txt")
print("summary", s.exists(), "build_size", b.stat().st_size if b.exists() else 0)
# wait more
for i in range(18):
    time.sleep(10)
    print(f"t+={(i+1)*10}s summary={s.exists()} build_size={b.stat().st_size if b.exists() else 0}", flush=True)
    if s.exists():
        print(s.read_text(encoding="utf-8", errors="replace"))
        break
else:
    print("BUILD TAIL:")
    print(b.read_text(encoding="utf-8", errors="replace")[-3000:])
