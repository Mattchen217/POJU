from pathlib import Path
t = Path("temp/out_m24r2fu2_m1adaptive.txt").read_text(encoding="utf-8", errors="replace")
# write ascii-safe
safe = t.encode("ascii", "backslashreplace").decode("ascii")
Path("temp/out_m24r2fu2_m1adaptive_ascii.txt").write_text(safe, encoding="utf-8")
print("len", len(safe))
print(safe[-6000:])
