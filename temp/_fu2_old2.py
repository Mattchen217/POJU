from pathlib import Path
lines = Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8").splitlines()
out = []
for start,end in [(300,360),(410,530),(630,720),(810,890)]:
    out.append(f"\n===== {start}-{end} =====")
    for i in range(start-1, min(end, len(lines))):
        out.append(f"{i+1:4d}: {lines[i]}")
Path("temp/_fu2_oldcases_out.txt").write_text("\n".join(out), encoding="utf-8")
print("wrote", len(out))
