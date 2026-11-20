from pathlib import Path
p=Path(r"lib/poju/agent.ts")
lines=p.read_text(encoding="utf-8").splitlines()
ranges=[(990,1160),(1180,1380),(1400,1480),(1700,1820),(2030,2260)]
for a,b in ranges:
    print("="*80, a, b)
    print("\n".join(f"{i}:{lines[i-1]}" for i in range(a, min(b, len(lines))+1)))
