from pathlib import Path
cur = Path("public/v2-landing.html").read_text(encoding="utf-8", errors="replace")

# Order checks
positions = {
    "eos-top": cur.find('id="eos-landing-v2-top"'),
    "nav": cur.find('<nav class="fixed top-0'),
    "nav-install": cur.find('id="v2-nav-install"'),
    "v2-hero": cur.find('id="v2-hero"'),
    "hero-cta-start": cur.find('id="v2-hero-cta-start"'),
    "productPrice html": cur.find('data-eos-v2="productPrice"'),
    "old $9.99 pass": cur.find('id="v2-pass-buy-price"'),
}
for k,v in positions.items():
    print(f"{k}: {v}")
assert positions["eos-top"] < positions["nav"] < positions["v2-hero"]
assert positions["nav-install"] > positions["nav"]

# productPrice content
i = positions["productPrice html"]
print("price html:", cur[i:i+200])

# JS productPrice en/zh
i = cur.find('productPrice:')
print("js price snippets:")
start = 0
while True:
    i = cur.find("productPrice:", start)
    if i < 0: break
    print(" ", cur[i:i+120].replace("\n"," "))
    start = i + 1

# A1 ZH
print("ZH hero present:", "马上开始" in cur or "马上" in cur)
# find hero locale strings
for needle in ["unstick it", "Walk out with a path", "Start now", "Install app", "添加到桌面"]:
    print(f"  {needle!r}:", cur.count(needle))

print("file only public/v2-landing.html changed intended")
