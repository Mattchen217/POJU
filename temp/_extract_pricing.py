import sys
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html", "r", encoding="utf-8") as f:
    lines = f.readlines()
with open("temp/_pricing_slice.txt", "w", encoding="utf-8") as out:
    out.write("=== v2-price / pricing section refs ===\n")
    for i, l in enumerate(lines):
        if "v2-price" in l or 'id="pricing' in l:
            out.write("%d|%s" % (i + 1, l))
    out.write("\n=== applyPricing block 3155-3330 ===\n")
    for i in range(3155, min(3330, len(lines))):
        out.write("%d|%s" % (i + 1, lines[i]))
    out.write("\n=== family handlers 3760-3830 ===\n")
    for i in range(3755, min(3835, len(lines))):
        out.write("%d|%s" % (i + 1, lines[i]))
    # find end of PRICING_I18N
    depth = 0
    started = False
    for i in range(2901, len(lines)):
        if "const PRICING_I18N" in lines[i]:
            started = True
        if started:
            depth += lines[i].count("{") - lines[i].count("}")
            if depth <= 0 and i > 2902:
                out.write("\nPRICING_I18N_END=%d\n" % (i + 1))
                break
    # locales present
    out.write("\n=== locale keys in PRICING_I18N ===\n")
    for i in range(2901, i + 1):
        if lines[i].strip().startswith('"') and lines[i].strip().endswith('": {'):
            out.write("%d|%s" % (i + 1, lines[i]))
print("ok end", i+1)
