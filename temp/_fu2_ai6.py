from pathlib import Path
text = Path("lib/poju/decision-intake/answer-interpretation.ts").read_text(encoding="utf-8")
for i,l in enumerate(text.splitlines(),1):
    if "import type" in l or "UnresolvedAnswer" in l[:80] and "import" in l:
        if i < 20 or "Unresolved" in l:
            print(f"{i}: {l}")
# first 20 lines
print("--- first 20 ---")
print("\n".join(f"{i}: {l}" for i,l in enumerate(text.splitlines()[:20],1)))
