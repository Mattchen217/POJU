import sys, time
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
exitf = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_build.exit")
log = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_build.txt")
for i in range(24):
    time.sleep(15)
    print(f"t+={(i+1)*15}s exit={exitf.exists() and exitf.read_text(encoding='utf-8')} log={log.stat().st_size if log.exists() else 0}", flush=True)
    if exitf.exists():
        print("EXIT", exitf.read_text(encoding="utf-8"))
        print(log.read_text(encoding="utf-8", errors="replace")[-4000:])
        break
else:
    print("still running, log tail:")
    print(log.read_text(encoding="utf-8", errors="replace")[-2000:])
