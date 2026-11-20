from pathlib import Path
t = Path("temp/out_m24r2fu2_m1adaptive.txt").read_text(encoding="utf-8", errors="replace")
lines = t.splitlines()
fails = []
for i,l in enumerate(lines):
    if "FAIL" in l and ("M2" in l or "M1" in l or "Case" in l or "  FAIL" in l):
        fails.append((i, l))
print("fail markers", len(fails))
for i,l in fails:
    print("----", i, l.encode("ascii","backslashreplace").decode())
    # print following 40 lines
    chunk = "\n".join(lines[i:i+50])
    Path("temp/_fu2_fail_chunk_%d.txt" % i).write_text(chunk.encode("ascii","backslashreplace").decode(), encoding="utf-8")
print("\nwritten chunks")
