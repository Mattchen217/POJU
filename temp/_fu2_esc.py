from pathlib import Path
t = Path("temp/out_m24r2fu2_case_logs.txt").read_text(encoding="utf-8")
for i,l in enumerate(t.splitlines(),1):
    print(i, l.encode("unicode_escape").decode())
