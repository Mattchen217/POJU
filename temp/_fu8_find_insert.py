from pathlib import Path
lines=Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8").splitlines()
for i,l in enumerate(lines,1):
    if "const modelSrc" in l or "FU7-CC-P" in l:
        print(f"{i}:{l}")
print("total", len(lines))
