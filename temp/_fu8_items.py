from pathlib import Path
import re
src = Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8")
# Find handleUserMessage blocks and drafts together is hard.
# Instead, find every object that has text: and semantic_kind:
pat = re.compile(r"\{[^{}]*?text:\s*(\"([^\"]*)\"|[A-Za-z0-9_]+)[^{}]*?semantic_kind:[^{}]*?\}", re.S)
# also items built as { text: x, semantic_kind
items=[]
for m in pat.finditer(src):
    frag=m.group(0)
    line=src[:m.start()].count("\n")+1
    items.append((line, frag.replace("\n"," ")[:240]))
print("object items", len(items))
for line, frag in items:
    print(f"L{line}: {frag}")
# also look for extracted_items: [ or push({ without text string
print("\n--- extracted_items followed by non-literal ---")
for m in re.finditer(r"extracted_items:\s*([^\n]+)", src):
    line=src[:m.start()].count("\n")+1
    print(f"L{line}: extracted_items: {m.group(1)[:200]}")
