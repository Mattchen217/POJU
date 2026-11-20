from pathlib import Path
t = Path("docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R2-FU2.md").read_text(encoding="utf-8")
# print log section as ascii to confirm insertion
idx = t.find("```")
print("first fence", idx)
# find FU2-A log
i = t.find("[m24r2fu2a]")
print("fu2a idx", i)
print(t[i:i+400].encode("ascii","backslashreplace").decode())
print("--- tip ---")
for l in t.splitlines():
    if "Evidence tip" in l or "Implementation commit" in l or "Parent" in l:
        print(l)
