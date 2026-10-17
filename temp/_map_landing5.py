import sys,re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
lines = text.splitlines(True)

patterns = [
    r"Five Specialized", r"Five Engines", r"Specialized Engines", r"Five</span> Specialized",
    r"\$4\.99", r"\$9\.99", r"\$29\.99", r"\$3\.99", r"\$2\.99", r"PASS_UNIT\s*=\s*9\.99",
    r"all 5 products", r"5 productos", r"5 produits", r"五个", r"5 个产品", r"5产品",
    r"Monthly Pass", r"monthly Pass",
]
for p in patterns:
    ms = list(re.finditer(p, text))
    print(f"{p!r}: {len(ms)}")
    for m in ms[:5]:
        line = text[:m.start()].count("\n")+1
        print(f"  L{line}")

# product-as-SKU in nav/footer
print("\n--- nav/footer product lines ---")
for i,l in enumerate(lines):
    if any(x in l for x in ["tab=atmos","tab=poju","tab=match","tab=syncro","tab=glyph","Match Analysis","Syncro","Glyph","Atmos","Pivot"]):
        if i+1 < 1922 or (2544 <= i+1 <= 2599) or "engines" in l.lower() or "pricing" in l.lower() or "$" in l:
            print(f"{i+1}: {l.strip()[:130]}")

# i18n engines / pricing block bounds
print("\n--- script i18n anchors ---")
for i,l in enumerate(lines):
    if any(x in l for x in ["ENGINES_I18N","enginesI18n","PRICING_I18N","pricingI18n","const engines","applyEngines","applyPricing","FAQ_I18N","faqData","v2Engines","passQty","card1","Atmos / Pivot"]):
        print(f"{i+1}: {l.strip()[:130]}")
