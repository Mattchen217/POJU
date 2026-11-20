import subprocess
from pathlib import Path
r = subprocess.run(
    "pnpm test:m1-production-adaptive-question-loop",
    capture_output=True,
    cwd=r"D:\POJU\pojulife",
    shell=True,
)
out = None
for enc in ("utf-8", "gbk", "cp936"):
    try:
        cand = (r.stdout or b"").decode(enc)
        if "[m24a]" in cand:
            out = cand
            print("decoded", enc)
            break
    except Exception as e:
        print(enc, e)
if out is None:
    out = (r.stdout or b"").decode("utf-8", errors="replace")
Path(r"temp/m24/m1_clean.txt").write_text(out + "\n" + (r.stderr or b"").decode("utf-8", errors="replace"), encoding="utf-8")
lines = [ln for ln in out.splitlines() if "[m24" in ln or "PASS  M2.4" in ln or "M1 done" in ln]
Path(r"temp/m24/case_excerpts_utf8.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("exit", r.returncode, "lines", len(lines))
Path(r"temp/m24/case_esc.txt").write_text("\n".join(ln.encode("unicode_escape").decode("ascii") for ln in lines)+"\n", encoding="ascii")
print(Path(r"temp/m24/case_esc.txt").read_text(encoding="ascii"))
