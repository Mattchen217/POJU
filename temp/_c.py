import re
text=open("public/v2-landing.html",encoding="utf-8").read()
out=[]
for pat in [r"\.v2-product-carousel\s+img[^{]*\{[^}]+\}", r"\.v2-product-carousel\s+img\.is-active[^{]*\{[^}]+\}", r"\.v2-product-carousel img[^{]*\{[^}]+\}"]:
    for m in re.finditer(pat, text, re.S):
        out.append(m.group(0)+"\n\n")
# any aspect-
for line in text.splitlines():
    if "product-carousel" in line or "aspect-" in line and "product" in line:
        out.append(line.strip()+"\n")
open("temp/_carousel_css.txt","w",encoding="utf-8").write("".join(out) or "none")
print(open("temp/_carousel_css.txt",encoding="utf-8").read())
