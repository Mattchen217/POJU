import sys, time, subprocess
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
s = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_summary.txt")
b = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_build.txt")
for i in range(24):
    time.sleep(10)
    # node still there?
    try:
        out = subprocess.check_output('tasklist /FI "IMAGENAME eq node.exe" /FO LIST', shell=True, text=True, errors="replace")
        alive = "node.exe" in out.lower() or "Node.exe" in out or "映像名称" in out and "node.exe" in out
        mem = ""
        for line in out.splitlines():
            if "内存" in line or "Mem" in line:
                mem = line
    except Exception as e:
        alive, mem = str(e), ""
    print(f"t+={(i+1)*10}s summary={s.exists()} build={b.stat().st_size if b.exists() else 0} node_alive={('PID' in out) if 'out' in dir() else '?' } {mem}", flush=True)
    if s.exists():
        print(s.read_text(encoding="utf-8", errors="replace"))
        print("BUILD TAIL:")
        print(b.read_text(encoding="utf-8", errors="replace")[-2500:])
        break
else:
    print("STILL WAITING")
    print(b.read_text(encoding="utf-8", errors="replace")[-2500:])
