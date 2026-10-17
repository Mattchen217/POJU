import sys,re
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html","r",encoding="utf-8") as f:
    content=f.read()
    lines=content.splitlines()
for name in ["escapeHtml","fillTpl","pickPlural","closeUpsell","beginPurchase","PASS_UNIT","setPassQty","isBonusFeature","splitFeatureText","renderFeatureItem","META_LABELS","fillUpsellTpl"]:
    hits=[i+1 for i,l in enumerate(lines) if re.search(r'\b'+name+r'\b', l)]
    print(name, hits)
