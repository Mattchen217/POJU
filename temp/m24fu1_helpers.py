from pathlib import Path
t = Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8")
lines = t.splitlines()
# print helpers: jobDirs, seedSession, DIR-OPT
for i,line in enumerate(lines):
    if any(k in line for k in ["jobDirs", "DIR-OPT-ON-TABLE", "seedSession", "function seed", "moveDirs", "const NOW"]):
        print(f"{i+1}|{line}")
print("--- first 200 lines ---")
print("\n".join(f"{i+1}|{lines[i]}" for i in range(0, 220)))
