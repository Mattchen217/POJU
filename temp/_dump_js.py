import sys
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html","r",encoding="utf-8") as f:
    lines=f.readlines()
with open("temp/_pricing_js.txt","w",encoding="utf-8") as out:
    # from PASS_UNIT through end of pricing handlers
    for i in range(2875, min(3350, len(lines))):
        out.write("%d|%s" % (i+1, lines[i]))
    out.write("\n===== 3740-3825 =====\n")
    for i in range(3735, min(3830, len(lines))):
        out.write("%d|%s" % (i+1, lines[i]))
    # find applyPricingCopy callers
    out.write("\n===== callers =====\n")
    for i,l in enumerate(lines):
        if "applyPricingCopy" in l or "openUpsell" in l or "syncPassUi" in l or "pricingPack" in l or "PRICING_I18N" in l:
            out.write("%d|%s" % (i+1, l))
print("done")
