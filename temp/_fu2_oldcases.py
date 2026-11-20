from pathlib import Path
lines = Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8").splitlines()
for start,end in [(259,360),(430,520),(640,720),(800,860)]:
    print(f"\n===== {start}-{end} =====")
    for i in range(start-1, min(end, len(lines))):
        print(f"{i+1:4d}: {lines[i]}")
