from pathlib import Path
import re
p = Path("scripts/test-m1-production-adaptive-question-loop.ts")
text = p.read_text(encoding="utf-8")

# 1) texts.map((text) => ({ text,  ... add source_quote: text
old = "        extracted_items: texts.map((text) => ({\n          text,\n"
new = "        extracted_items: texts.map((text) => ({\n          text,\n          source_quote: text,\n"
count = text.count(old)
print("texts.map blocks", count)
text = text.replace(old, new)

# 2) item.draft.extracted_items.map — add source_quote fallback
old = '''          extracted_items: item.draft.extracted_items.map((row) => ({
            ...row,
            role_code_hint: row.role_code_hint ?? legalCode,
          })),
'''
new = '''          extracted_items: item.draft.extracted_items.map((row) => ({
            ...row,
            role_code_hint: row.role_code_hint ?? legalCode,
            source_quote: row.source_quote ?? row.text,
          })),
'''
assert old in text
text = text.replace(old, new, 1)

# 3) For object literals with text: "..." or text: item.text or text: shared,
# insert source_quote on the next line if not already present.

lines = text.splitlines(True)
out = []
i = 0
added = 0
while i < len(lines):
    line = lines[i]
    out.append(line)
    m = re.match(r'^(\s*)text:\s*(.+?),\s*$', line)
    if m:
        indent = m.group(1)
        expr = m.group(2).rstrip()
        # look ahead: if next non-empty is source_quote, skip
        j = i + 1
        nxt = lines[j] if j < len(lines) else ""
        # only if this looks like an extracted item (semantic_kind follows soon)
        window = "".join(lines[i+1:i+8])
        if "semantic_kind" in window and "source_quote:" not in window.split("}")[0]:
            out.append(f"{indent}source_quote: {expr},\n")
            added += 1
    i += 1

text = "".join(out)
p.write_text(text.replace("\r\n","\n"), encoding="utf-8", newline="\n")
print("added source_quote lines", added)
# verify no extracted item object lacks source_quote near semantic_kind
missing = 0
body = text
# crude: semantic_kind blocks without source_quote in preceding 6 lines
ls = text.splitlines()
for i,l in enumerate(ls):
    if "semantic_kind:" in l:
        prev = "\n".join(ls[max(0,i-8):i+1])
        if "source_quote" not in prev and "text:" in prev:
            missing += 1
            print("MISSING near", i+1, ls[i-2:i+1])
print("still missing", missing)
