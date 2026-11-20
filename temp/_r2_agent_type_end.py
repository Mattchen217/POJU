from pathlib import Path
lines = Path(r"lib/poju/agent.ts").read_text(encoding="utf-8").splitlines()
print("\n".join(f"{j}:{lines[j-1]}" for j in range(2148, 2210)))
