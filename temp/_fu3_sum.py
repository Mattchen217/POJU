import sys,re
sys.stdout.reconfigure(encoding="utf-8")
text=open(r"D:\POJU\pojulife\temp\out_m24r2fu3_m1adaptive.txt",encoding="utf-8",errors="replace").read()
for line in text.splitlines():
    if "PASS  M2.4-R2-FU3" in line or "FAIL  M2.4-R2-FU3" in line or "M1 done" in line or line.startswith("  PASS  M2.4-R2-FU2") or "FAIL  " in line:
        print(line)
# counts
passes=len(re.findall(r"^  PASS  ", text, re.M))
fails=len(re.findall(r"^  FAIL  ", text, re.M))
print(f"counts PASS={passes} FAIL={fails}")
# ensure normalizeComparable gone
src=open(r"D:\POJU\pojulife\lib\poju\decision-intake\answer-interpretation-model.ts",encoding="utf-8").read()
print("normalizeComparable left", "normalizeComparable" in src)
