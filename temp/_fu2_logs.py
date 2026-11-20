from pathlib import Path
t = Path("temp/out_m24r2fu2_m1adaptive_r2.txt").read_text(encoding="utf-8", errors="replace")
logs = []
for l in t.splitlines():
    if l.startswith("[m24r2fu2") or l.startswith("[m24r2g]") or l.startswith("[m24r2i]"):
        logs.append(l)
Path("temp/out_m24r2fu2_case_logs.txt").write_text("\n".join(logs)+"\n", encoding="utf-8")
print("logs", len(logs))
for l in logs:
    print("LEN", len(l), "START", l[:80].encode("ascii","backslashreplace").decode())
