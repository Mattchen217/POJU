from pathlib import Path
# build confirmation
t = Path("temp/out_m24r2fu2_build_r2.txt").read_text(encoding="utf-8", errors="replace")
safe = t.encode("ascii","backslashreplace").decode()
print("BUILD TAIL:")
print("\n".join(safe.splitlines()[-25:]))
print("\n--- git ---")
