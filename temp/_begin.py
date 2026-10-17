import sys
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html","r",encoding="utf-8") as f:
    lines=f.readlines()
for i in range(3470, min(3520, len(lines))):
    print("%d|%s" % (i+1, lines[i]), end="")
print("--- eos cta purchase ---")
for i,l in enumerate(lines):
    if "beginPurchase" in l or "eos-v2-cta" in l and "click" in l:
        print(i+1, l.strip()[:140])
