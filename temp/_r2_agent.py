from pathlib import Path
p=Path(r"lib/poju/agent.ts")
lines=p.read_text(encoding="utf-8").splitlines()
# print around assistant message creation
ranges=[(820,900),(980,1040),(1080,1370),(1420,1480),(1720,1820),(1940,2040)]
for a,b in ranges:
    print("="*80, a, b)
    print("\n".join(f"{i}:{lines[i-1]}" for i in range(a, min(b, len(lines))+1)))
