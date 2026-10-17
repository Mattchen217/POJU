# -*- coding: utf-8 -*-
import sys
html = open(r"D:\POJU\pojulife\public\v2-landing.html", encoding="utf-8").read()
checks = []
def ok(name, cond, detail=""):
    checks.append((name, bool(cond), detail))
    print(("PASS" if cond else "FAIL"), name, detail)

ok("no v2-price-family", 'id="v2-price-family"' not in html)
ok("no $59.90 anywhere", "$59.90" not in html)
ok("PASS_UNIT 19.99", "const PASS_UNIT = 19.99;" in html)
ok("buy default $19.99", 'id="v2-pass-buy-price">$19.99' in html)
ok("grid-cols-2", 'md:grid-cols-2 gap-8 items-stretch" id="v2-price-grid"' in html)
ok("keep flex+personal", 'id="v2-price-flex"' in html and 'id="v2-price-personal"' in html)

s = html.find("const PRICING_I18N")
e = html.find("function pricingPack")
block = html[s:e]
ok("no Atmos/Pivot in i18n", "Atmos / Pivot" not in block)
ok("no $9.99 in i18n", "$9.99" not in block)
ok("no $29.90 in i18n", "$29.90" not in block)
ok("no $59.90 in i18n", "$59.90" not in block)
ok("no 15 Pass in i18n", "15 Pass" not in block)
ok("EN H2", "Clear pricing. Your call." in block)
ok("ZH H2", "透明定价，随心选择" in block)
ok("card prices", '"$19.99"' in block and '"$59.99"' in block)
ok("ctaTitle Subscribe", '"ctaTitle": "Subscribe"' in block)
ok("ZH title sub", "订阅包" in block and "购买 Pass" in block)
ok("strong markers", "<strong>1 Pass</strong>" in block and "provided together" in block and "同步提供" in block)
ok("allowStrong", "function allowStrong" in html)
ok("header innerHTML", "el.innerHTML = pack.header[key]" in html)
ok("card2.ctaTitle attr", 'data-pricing-c="card2.ctaTitle"' in html)
ok("HOW_GET intact", "HOW_GET_COPY" in html)
ok("PRIVACY intact", "PRIVACY_COPY" in html)
ok("es/fr absent (fallback EN)", '"es"' not in block and '"fr"' not in block)
ok("no fine print added", "After cancel, unused Pass" not in html)

sec = html[html.find('id="v2-pricing"'):html.find('id="v2-faq"')]
n_articles = sec.count("<article")
ok("exactly 2 price articles", n_articles == 2, str(n_articles))

# checkout handlers still present (untouched)
ok("beginPurchase flex still", "beginPurchase({ plan: 'flex_pass'" in html)
ok("beginPurchase personal still", "beginPurchase({ plan: 'personal_plan' })" in html)
ok("familyCta query still (null-safe)", "v2-price-family" in html)  # JS string refs OK

fails = [c for c in checks if not c[1]]
print("---")
print("%d/%d passed" % (len(checks)-len(fails), len(checks)))
for f in fails:
    print("FAIL DETAIL:", f)
sys.exit(1 if fails else 0)
