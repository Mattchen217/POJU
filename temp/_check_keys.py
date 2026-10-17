from pathlib import Path
import re
block = Path("temp/_eos_html_extract.html").read_text(encoding="utf-8")
# list sections
for m in re.finditer(r'<section[^>]*class="([^"]+)"[^>]*(?:aria-labelledby="([^"]*)")?', block):
    print("section", m.group(1), m.group(2))
print("len", len(block), "lines", block.count("\n"))
# data-eos-v2 keys in HTML
keys = re.findall(r'data-eos-v2="([^"]+)"', block)
print("keys", keys)
js = Path("temp/_eos_js_extract.js").read_text(encoding="utf-8")
# keys in en pack
en = re.search(r"en:\s*\{(.*?)\n  \},\n  zh:", js, re.S)
if en:
    jk = re.findall(r"^\s+(\w+):", en.group(1), re.M)
    print("js en keys", jk)
    missing = set(keys) - set(jk)
    extra = set(jk) - set(keys)
    print("missing in js", missing)
    print("extra in js", extra)

cur = Path("public/v2-landing.html").read_text(encoding="utf-8", errors="replace")
ei = cur.find("function escapeHtml")
print("before escapeHtml:")
print(repr(cur[ei-250:ei]))
