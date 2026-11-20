import sys, subprocess, time
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
for name in ["python.exe", "node.exe", "pnpm.exe", "pnpm.cmd"]:
    try:
        out = subprocess.check_output(f'wmic process where "name=\'{name}\'" get ProcessId,CommandLine /FORMAT:LIST', shell=True, text=True, errors="replace")
        if "ProcessId" in out:
            # redact any api keys if present
            lines=[]
            for line in out.splitlines():
                if "api-key" in line.lower() or "crsr_" in line:
                    line = "CommandLine=<redacted cursor worker>"
                lines.append(line)
            print("====", name, "====")
            print("\n".join(lines)[:4000])
    except Exception as e:
        print(name, "err", e)

nxt = Path(r"D:\POJU\pojulife\.next")
files = [p for p in nxt.rglob("*") if p.is_file()] if nxt.exists() else []
files = sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)
print("now", time.strftime("%H:%M:%S"))
print("newest .next:")
for p in files[:10]:
    print(time.strftime("%H:%M:%S", time.localtime(p.stat().st_mtime)), p.stat().st_size, p)
