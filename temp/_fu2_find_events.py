from pathlib import Path
hits = []
for path in Path(".").rglob("*.ts"):
    s = str(path).replace("\\", "/")
    if "node_modules" in s or "temp/" in s or ".next" in s:
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        continue
    if "proposed_writes" in text and "interpreter:" in text:
        hits.append(s)
    if "as AnswerEvent" in text or ": AnswerEvent =" in text:
        hits.append("LITERAL? " + s)
print("\n".join(sorted(set(hits))))
