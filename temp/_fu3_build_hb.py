import subprocess, os, time, threading, sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
os.chdir(r"D:\POJU\pojulife")
pnpm = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
sha = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
log = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_build.txt")
log.write_text(f"# SHA {sha}\n# CMD {pnpm} build\n", encoding="utf-8")

f = open(log, "a", encoding="utf-8", errors="replace")
p = subprocess.Popen([pnpm, "build"], stdout=f, stderr=subprocess.STDOUT, cwd=r"D:\POJU\pojulife")
t0 = time.time()
print(f"build started pid={p.pid} sha={sha}", flush=True)
while True:
    rc = p.poll()
    elapsed = time.time() - t0
    size = log.stat().st_size
    if rc is not None:
        f.flush()
        print(f"DONE exit={rc} elapsed={elapsed:.1f}s log={size}", flush=True)
        break
    print(f"heartbeat elapsed={elapsed:.0f}s log={size} pid={p.pid}", flush=True)
    time.sleep(10)
f.close()
# print tail
text = log.read_text(encoding="utf-8", errors="replace")
print("---- BUILD TAIL ----", flush=True)
print(text[-3000:], flush=True)
Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_build.exit").write_text(str(rc), encoding="utf-8")
