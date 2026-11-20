from pathlib import Path
t = Path("temp/out_m24r2fu2_m1adaptive2.txt").read_text(encoding="utf-8", errors="replace")
safe = t.encode("ascii", "backslashreplace").decode("ascii")
Path("temp/out_m24r2fu2_m1adaptive2_ascii.txt").write_text(safe, encoding="utf-8")
fails = [l for l in safe.splitlines() if l.strip().startswith("FAIL") or "FAIL=" in l or "PASS=" in l or l.strip().startswith("PASS")]
print("lines", len(safe.splitlines()), "bytes", len(safe))
for l in safe.splitlines():
    if "PASS=" in l or "FAIL=" in l or "M1 done" in l or l.startswith("  FAIL") or l.startswith("  PASS") and ("FU2" in l or "Case G" in l or "m1-production" in l):
        print(l)
print("--- FU2 logs ---")
for l in safe.splitlines():
    if "[m24r2fu2" in l or "[m24r2g]" in l or "[m24r2i]" in l:
        print(l)
print("--- fail count ---")
print("FAIL lines", sum(1 for l in safe.splitlines() if l.startswith("  FAIL")))
print("PASS lines", sum(1 for l in safe.splitlines() if l.startswith("  PASS")))
