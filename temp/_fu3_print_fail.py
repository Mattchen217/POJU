import sys,re
sys.stdout.reconfigure(encoding="utf-8")
text=open(r"D:\POJU\pojulife\temp\out_m24r2fu3_m1adaptive.txt",encoding="utf-8",errors="replace").read()
# find FAIL FU3-B and following 40 lines
idx=text.find("FAIL  M2.4-R2-FU3-B")
print(text[idx:idx+4000] if idx>=0 else "NOT FOUND")
print("\n---- PASS/FAIL ----")
print("PASS", text.count("  PASS  "))
print([line for line in text.splitlines() if "M1 done" in line or "FAIL  M" in line or "ELIFECYCLE" in line])
