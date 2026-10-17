from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
# order check
order = []
for key in ["v2-hero", "v2-product-preview", "v2-scenarios", "eos-landing-scenarios", "v2-engines"]:
    order.append((t.find(f'id="{key}"'), key))
order.sort()
print("order:", [k for _,k in order if _>=0])
# product section snip
i = t.find('id="v2-product-preview"')
Path("temp/_glass_verify.txt").write_text(t[i-9:i+1200], encoding="utf-8")
assert "v2-glass-strip" in t
assert 'id="v2-product-carousel"' in t
assert "/v2/v2.png" in t and "/v2/V3.png" in t and "/v2/v4.png" in t
# JS still references carousel
assert "v2-product-carousel" in t
print("verify ok")
print(t[i-9:i+900])
