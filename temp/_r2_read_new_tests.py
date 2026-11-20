from pathlib import Path
lines = Path(r"scripts/test-m8-r1-internal-turn-trust-boundary.ts").read_text(encoding="utf-8").splitlines()
print("line894 repr:", repr(lines[893]))
print("----- helpers 250-280? authority -----")
for i,l in enumerate(lines,1):
    if 200 <= i <= 280:
        print(f"{i}:{l}")
print("----- new api test -----")
for i,l in enumerate(lines,1):
    if 770 <= i <= 920:
        print(f"{i}:{l}")
