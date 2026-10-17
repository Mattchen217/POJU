import re
text = open("public/v2-landing.html", encoding="utf-8").read()
out=[]
for pat in [r"\.v2-product-screen\s*\{[^}]+\}", r"\.v2-product-carousel\s*\{[^}]+\}", r"\.v2-product-stage\s*\{[^}]+\}", r"\.v2-product-halo\s*\{[^}]+\}", r"#v2-hero-title\s*\{[^}]+\}", r"#v2-hero-subtitle\s*\{[^}]+\}", r"\.v2-hero-ctas\s*\{[^}]+\}"]:
    m=re.search(pat, text, re.S)
    out.append((m.group(0) if m else f"MISSING {pat}")+"\n\n")
open("temp/_hero_css2.txt","w",encoding="utf-8").write("".join(out))
print("ok")
