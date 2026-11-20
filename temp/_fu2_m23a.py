from pathlib import Path
lines = Path("scripts/test-m2-3-decision-blueprint.ts").read_text(encoding="utf-8").splitlines()
out = []
for i in range(1570, 1720):
    if i < len(lines):
        out.append(f"{i+1:4d}: {lines[i]}")
Path("temp/_fu2_m23_casea.txt").write_text("\n".join(out), encoding="utf-8")
print("\n".join(o.encode("ascii","backslashreplace").decode() for o in out[:200]))
