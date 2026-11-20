from pathlib import Path
text = Path(r"scripts/test-m8-r1-internal-turn-trust-boundary.ts").read_text(encoding="utf-8")
for i,l in enumerate(text.splitlines(),1):
    if i <= 60 or "handleUserMessage" in l or "assert.match" in l or "from \"../lib/poju/agent" in l or "await import" in l:
        if i<=60 or "handleUserMessage" in l or "assert.match" in l or "import(" in l or "from \"../lib/poju" in l:
            print(f"{i}:{l}")
