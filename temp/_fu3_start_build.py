import subprocess, os, time
from pathlib import Path

os.chdir(r"D:\POJU\pojulife")
pnpm = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
sha = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
log = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_build.txt")
exitf = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_build.exit")
if exitf.exists():
    exitf.unlink()
log.write_text(f"# SHA {sha}\n# CMD {pnpm} build\n# started_detached=1\n", encoding="utf-8")

# wrapper writes exit code when done
wrapper = Path(r"D:\POJU\pojulife\temp\_fu3_build_wrap.py")
wrapper.write_text(rf'''
import subprocess, os
from pathlib import Path
os.chdir(r"D:\POJU\pojulife")
pnpm = r"{pnpm}"
log = Path(r"{log}")
exitf = Path(r"{exitf}")
with log.open("a", encoding="utf-8", errors="replace") as f:
    p = subprocess.run([pnpm, "build"], stdout=f, stderr=subprocess.STDOUT)
exitf.write_text(str(p.returncode), encoding="utf-8")
''', encoding="utf-8")

DETACHED = 0x00000008
NEW_GROUP = 0x00000200
# Don't use DETACHED only with inherited files; start via pythonw-less python in new process group, no window
si = subprocess.STARTUPINFO()
si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
si.wShowWindow = 0
p = subprocess.Popen(
    ["python", str(wrapper)],
    cwd=r"D:\POJU\pojulife",
    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW,
    startupinfo=si,
    close_fds=True,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
print("started pid", p.pid, "sha", sha)
# confirm it stays up
time.sleep(2)
print("poll", p.poll(), "exitf", exitf.exists(), "logsize", log.stat().st_size)
