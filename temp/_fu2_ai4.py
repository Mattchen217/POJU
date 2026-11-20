from pathlib import Path
text = Path("lib/poju/decision-intake/answer-interpretation.ts").read_text(encoding="utf-8")
idx = text.find("export function answerEventFromModelDraft")
print(text[idx:idx+5500])
