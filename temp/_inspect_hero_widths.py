import re
text = open("public/v2-landing.html", encoding="utf-8").read()
out = []
for key in ["id=\"v2-hero\"", "id=\"v2-product-preview\"", "id=\"eos-landing-scenarios\"", "id=\"v2-scenarios\""]:
    i = text.find(key)
    out.append(f"==== {key} idx {i}\n")
    if i >= 0:
        # find opening tag start
        start = text.rfind("<", 0, i+1)
        out.append(text[start:start+2500] + "\n\n")
m = re.search(r"\.v2-product-frame\s*\{[^}]+\}", text, re.S)
out.append("FRAME CSS:\n" + (m.group(0) if m else "none") + "\n")
# also look for style blocks mentioning hero h1
for pat in [r"#v2-hero[^{]*\{[^}]+\}", r"\.v2-hero[^{]*\{[^}]+\}", r"#v2-hero\s+h1[^{]*\{[^}]+\}", r"v2-hero-title[^{]*\{[^}]+\}"]:
    for m in re.finditer(pat, text, re.S|re.I):
        out.append(f"CSS {pat}:\n{m.group(0)}\n")
open("temp/_hero_snip.txt","w",encoding="utf-8").write("".join(out))
print("wrote temp/_hero_snip.txt", len("".join(out)))
