from pathlib import Path
for p in Path("lib").rglob("*.ts"):
    t=p.read_text(encoding="utf-8")
    if "unresolved_items:" in t or "proposed_writes:" in t and "AnswerEvent" in t:
        if "lib/poju/decision-intake" in p.as_posix() or "AnswerEvent" in t:
            hits=[]
            for i,line in enumerate(t.splitlines(),1):
                if "unresolved_items:" in line or "interpreter:" in line:
                    hits.append(f"{i}:{line.strip()}")
            if hits:
                print(p.as_posix())
                print("\n".join(hits))
                print()
