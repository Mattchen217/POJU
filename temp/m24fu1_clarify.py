from pathlib import Path
import re
root = Path(".")
pats = ["clarifyConflict", "markOpenConflictsUnresolved", "openConflict", "conflict-lifecycle"]
for p in list(Path("lib").rglob("*.ts")) + list(Path("scripts").rglob("*.ts")):
    text = p.read_text(encoding="utf-8", errors="replace")
    for pat in pats:
        if pat in text:
            for i, line in enumerate(text.splitlines(), 1):
                if pat in line:
                    print(f"{p}:{i}:{line.strip()[:200]}")
