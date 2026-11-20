import os, re
# Find pending, persist, last_sent, session type files
needles = [
    "pending_answer_resolution",
    "POJUSessionState",
    "last_sent_question",
    "session_asked_count",
]
# Search in lib/poju for session type and persist
root = "lib/poju"
hits = []
for dirpath, _, files in os.walk(root):
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')): continue
        path = os.path.join(dirpath, fn)
        try:
            text = open(path, encoding='utf-8').read()
        except Exception:
            continue
        for n in needles + ["persistSession", "saveSession", "serializeSession", "fromJSON", "toJSON", "hydrate"]:
            if n in text:
                hits.append((n, path, text.count(n)))
                break

# Also list types.ts for session
print("=== HITS ===")
for n, p, c in sorted(set((h[1], h[0], h[2]) for h in hits)):
    pass
from collections import defaultdict
byfile = defaultdict(list)
for n,p,c in hits:
    byfile[p].append((n,c))
for p, items in sorted(byfile.items()):
    print(p, "->", items)
