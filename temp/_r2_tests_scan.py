from pathlib import Path
# print test file structure: cases, prompt history tests, helpers
p=Path(r"scripts/test-m8-r1-internal-turn-trust-boundary.ts")
lines=p.read_text(encoding="utf-8").splitlines()
print("TOTAL", len(lines))
for i,l in enumerate(lines,1):
    if l.startswith("async function") or l.startswith("function ") or l.startswith("test(") or "case" in l.lower() and ("test" in l.lower() or "assert" in l.lower()) or "PROMPT" in l or "sanitize" in l or "formatPhase" in l or "buildPhase" in l or "forged" in l or "runCase" in l or "describe" in l:
        print(f"{i}:{l}")
