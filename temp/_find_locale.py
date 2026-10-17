import sys,re
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html","r",encoding="utf-8") as f:
    lines=f.readlines()
# find locale change handlers that might call applyPricingCopy
for i,l in enumerate(lines):
    if re.search(r'applyPricingCopy|setLocale|currentLocale\s*=', l):
        print(i+1, l.strip()[:140])
# Check for personal_plan team_plan flex_pass
print("--- plans ---")
for i,l in enumerate(lines):
    if "personal_plan" in l or "team_plan" in l or "flex_pass" in l or "v2-price-family" in l or "v2-price-personal" in l:
        print(i+1, l.strip()[:140])
# Also check eos-v2 copy for productNote/ctaLegal side note
print("--- productNote ctaLegal ---")
for i,l in enumerate(lines):
    if "productNote" in l or "ctaLegal" in l:
        print(i+1, l.strip()[:160])
