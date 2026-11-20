from pathlib import Path
lines = Path("lib/poju/decision-intake/apply-answer-to-dc.ts").read_text(encoding="utf-8").splitlines()
for i in range(215, 245):
    print(f"{i+1:4d}: {lines[i]}")
print("\n===== m23 case A =====")
t = Path("temp/out_m24r2fu2_m23_ascii.txt").read_text(encoding="utf-8")
idx = t.find("FAIL  M2.3-R2-FU2 Case A")
print(t[idx:idx+4000])
