from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\adaptive-turn.ts")
text = p.read_text(encoding="utf-8")
print("sessionHasWritesFromTurn count", text.count("sessionHasWritesFromTurn"))
