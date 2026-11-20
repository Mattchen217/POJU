from pathlib import Path
lines = Path(r"lib/poju/agent.ts").read_text(encoding="utf-8").splitlines()
for i,l in enumerate(lines,1):
    if "LLMApiPayload" in l or "type LLMApi" in l or "interface LLMApi" in l:
        print(f"{i}:{l}")
