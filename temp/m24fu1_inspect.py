from pathlib import Path
import re
t = Path("lib/poju/decision-intake/types.ts").read_text(encoding="utf-8")
for m in re.finditer(r"last_sent_question[\s\S]{0,900}", t):
    print("---LAST_SENT---")
    print(m.group(0)[:900])
print("---SEARCH---")
root = Path("lib/poju")
pats = [
    "attachAuthorizedAssistantQuestion",
    "resolveConflict",
    "conflict_resolution",
    'state: "resolved"',
    "Conflict.state",
    "resolveOpenConflict",
    "markConflict",
]
for p in root.rglob("*.ts"):
    text = p.read_text(encoding="utf-8")
    for pat in pats:
        if re.search(pat, text, re.I):
            for i, line in enumerate(text.splitlines(), 1):
                if re.search(pat, line, re.I):
                    print(f"{p}:{i}:{line.strip()[:180]}")
