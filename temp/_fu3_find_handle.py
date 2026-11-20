from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\adaptive-turn.ts")
text = p.read_text(encoding="utf-8")
idx = text.find("async function handlePendingAnswerResolutionTurn")
print("idx", idx, "len", len(text))
print("tail starts with:\n", text[idx:idx+200])
print("--- end marker ---")
print(text[idx:].count("async function"))
# find end of file after this function
print("chars after idx", len(text[idx:]))
