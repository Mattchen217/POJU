from pathlib import Path
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
i = t.find("v2-product-screen")
while i >= 0:
    print(repr(t[max(0,i-30):i+50]))
    i = t.find("v2-product-screen", i+1)
# current product-preview markup
i = t.find('id="v2-product-preview"')
print("---MARKUP---")
print(t[i:i+700])
