import json, re, sys
sys.stdout.reconfigure(encoding="utf-8")

# messages
for loc in ["en", "zh", "es", "fr"]:
    with open(f"messages/{loc}.json", "r", encoding="utf-8") as f:
        d = json.load(f)
    print(f"=== messages/{loc}.json ===")
    print("L5:", repr(d["passPurchase"]["personalFeatures"][3]))
    print("hint:", repr(d["account"]["subCardHint"]))

# v2-landing card2 features
with open("public/v2-landing.html", "r", encoding="utf-8") as f:
    html = f.read()

# Find pricingI18n or similar object - look for card2 blocks with features arrays
# Extract each locale's card2 features[3]
pattern = re.compile(
    r'"(en|zh|es|fr)"\s*:\s*\{.*?\"card2\"\s*:\s*\{.*?\"features\"\s*:\s*\[(.*?)\]',
    re.DOTALL,
)
# Simpler: find all occurrences of features arrays near card2
# Just dump the L5-like lines
for needle in [
    "Subscription credits use first.",
    "订阅额度优先消耗",
    "Orden de consumo",
    "Ordre de consommation",
]:
    idx = 0
    while True:
        i = html.find(needle, idx)
        if i < 0:
            break
        start = max(0, i - 20)
        end = min(len(html), i + len(needle) + 200)
        snippet = html[start:end]
        # find the full quoted string containing this
        # walk back to quote
        qs = html.rfind('"', 0, i)
        # if strong tag, might start earlier
        # find line
        line_start = html.rfind("\n", 0, i) + 1
        line_end = html.find("\n", i)
        print("--- v2 line ---")
        print(repr(html[line_start:line_end].strip()))
        idx = i + 1
