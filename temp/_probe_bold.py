path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
import re
# sample strong / gold-gradient in i18n-like strings
print("strong total", text.count("<strong"))
print("gold-gradient total", text.count("gold-gradient"))
print("em total", text.count("<em"))
# find strong usages near copy
for m in re.finditer(r"<strong>[^<]{0,40}</strong>", text):
    if m.start() > 150000:  # near BUILT_COPY area or elsewhere
        pass
# show a few strong examples from the file
samples = list(re.finditer(r".{0,60}<strong>.{0,80}</strong>.{0,40}", text))
print("strong samples", len(samples))
for s in samples[:8]:
    print("---")
    print(s.group(0)[:200])
# gold in body paragraphs (not just headings)
golds = list(re.finditer(r'gold-gradient[^>]*>[^<]+', text))
print("gold spans", len(golds))
for g in golds[:15]:
    print(g.group(0)[:120])
