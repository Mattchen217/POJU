path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
start = text.find("const BUILT_COPY = {")
print("start", start)
i = text.find("{", start)
depth = 0
end = None
for k in range(i, len(text)):
    c = text[k]
    if c == "{":
        depth += 1
    elif c == "}":
        depth -= 1
        if depth == 0:
            end = k + 1
            break
print("end", end, "len", end - start)
block = text[start:end]
with open(r"temp\_built_copy.js", "w", encoding="utf-8") as f:
    f.write(block)
hstart = text.find('id="v2-built-heading"')
chunk_start = max(0, hstart - 500)
chunk = text[chunk_start:chunk_start + 9000]
with open(r"temp\_built_html.txt", "w", encoding="utf-8") as f:
    f.write(chunk)
import re
keys = re.findall(r'\n  "([a-z]{2})": \{', block)
print("locales", keys)
# print key names for en
en_start = block.find('"en": {')
en_end = block.find('\n  "zh": {', en_start)
en_block = block[en_start:en_end]
field_keys = re.findall(r'\n    "([A-Za-z0-9_]+)":', en_block)
print("en keys", field_keys)
