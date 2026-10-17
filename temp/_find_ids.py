import sys,re
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html","r",encoding="utf-8") as f:
    lines=f.readlines()
ids=["v2-pass-qty-label","v2-pass-buy","v2-pass-minus","v2-pass-plus","v2-price-modal","v2-price-modal-title","v2-price-modal-body","v2-price-modal-close","v2-price-modal-upgrade","v2-price-modal-keep","v2-pass-buy-price"]
for id_ in ids:
    # HTML id= occurrences (not getElementById)
    html_hits=[]
    js_hits=[]
    for i,l in enumerate(lines):
        if id_ in l:
            if "getElementById" in l or "querySelector" in l:
                js_hits.append(i+1)
            else:
                html_hits.append(i+1)
    print(id_, "html", html_hits, "js", js_hits)
# also check locale switch calling applyPricingCopy
for i,l in enumerate(lines):
    if "applyPricingCopy" in l or "currentLocale" in l and "apply" in l:
        if "applyPricing" in l or "function" in l or "applyBuilt" in l or "applyEos" in l or "applyTeam" in l or "applyFaq" in l:
            print("LOC", i+1, l.strip()[:120])
