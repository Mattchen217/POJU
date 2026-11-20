from pathlib import Path
# opening/confirmation history usage context
for f, starts in [
    ("lib/llm/phases/opening-phase.ts", [1, 25]),
    ("lib/llm/phases/opening-phase-v6.ts", [350]),
    ("lib/llm/phases/confirmation-phase.ts", [130]),
    ("lib/llm/phases/confirmation-phase-v6.ts", [170]),
    ("lib/llm/phases/oriental-prompt-context-v6.ts", [160, 300]),
]:
    lines=Path(f).read_text(encoding="utf-8").splitlines()
    print("="*80, f, "len", len(lines))
    for i,l in enumerate(lines,1):
        if "formatPhaseMessageHistory" in l or "sanitizeClientPromptHistory" in l or "buildPhaseTransportInput" in l or "async function" in l:
            print(f"{i}:{l}")
