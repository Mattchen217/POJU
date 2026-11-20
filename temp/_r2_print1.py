from pathlib import Path
# chat route and stream - print relevant parts
for path, ranges in [
    (r"app/api/poju/chat/route.ts", None),
    (r"lib/llm/phases/phase-transport.ts", None),
]:
    p=Path(path)
    lines=p.read_text(encoding="utf-8").splitlines()
    print("="*80)
    print(path, "TOTAL", len(lines))
    print("\n".join(f"{i+1}:{lines[i]}" for i in range(len(lines))))
