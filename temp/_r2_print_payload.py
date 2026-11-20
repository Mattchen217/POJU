from pathlib import Path
import os
# find serialize-chat-payload and client application of llm response
files = [
    "lib/poju/serialize-chat-payload.ts",
    "lib/poju/poju-chat-stream.ts",
]
for f in files:
    p=Path(f)
    lines=p.read_text(encoding="utf-8").splitlines()
    print("="*80, f, "TOTAL", len(lines))
    print("\n".join(f"{i+1}:{lines[i]}" for i in range(len(lines))))
