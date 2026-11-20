from pathlib import Path
print("=== IMPL MSG ===")
print(Path("temp/COMMIT_MSG_R2FU1_IMPL.txt").read_text(encoding="utf-8", errors="replace")[:1500])
print("=== EV MSG ===")
print(Path("temp/COMMIT_MSG_R2FU1_EV.txt").read_text(encoding="utf-8", errors="replace")[:800])
# evidence head
p = Path("docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R2-FU1.md")
t = p.read_text(encoding="utf-8")
print("=== FU1 EV HEAD ===")
print(t[:2500].encode("ascii","backslashreplace").decode())
print("lines", t.count("\n"))
