import sys,re
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html","r",encoding="utf-8") as f:
    content=f.read()
    lines=content.splitlines()
for pat in ["v2-price-grid","v2-price-personal","v2-price-family","data-pricing-","id=\"pricing\"","PASS_UNIT","passQty","eos-landing-v2-top"]:
    hits=[i+1 for i,l in enumerate(lines) if pat in l]
    print(pat, hits[:40], "n=",len(hits))
# Is there HTML for price cards?
print("--- looking for price card HTML ---")
for i,l in enumerate(lines):
    if re.search(r'id=["\']v2-price', l) or 'data-pricing-' in l:
        print(i+1, l.strip()[:160])
