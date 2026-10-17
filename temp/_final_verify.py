import sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
text = Path("public/v2-landing.html").read_text(encoding="utf-8")
lines = text.splitlines()
for i,l in enumerate(lines):
    if "Match" in l or "match" in l and ("tab=" in l or "MATCH" in l or "product" in l.lower()):
        if "Match" in l:
            print(f"{i+1}: {l.strip()[:140]}")
print("--- essentials ---")
print("eos css", text.count("#eos-landing-v2-top"))
print("styles", text.count("<style"), text.count("</style>"))
print("Unstick", "Unstick it" in text, "破开它", "破开它" in text)
print("$19.99", text.count("$19.99"), "$59.99", text.count("$59.99"))
print("v2-hero", 'id="v2-hero"' in text, "v2-engines", 'id="v2-engines"' in text)
print("lang", 'id="v2-lang-switcher"' in text, "faq", 'id="v2-faq"' in text)
print("lines", len(lines))
# also check Pivot as word in media match etc
for needle in ["Pivot", "poju", "Five", "Specialized", "Engines", "monthly", "Monthly"]:
    hits = [i+1 for i,l in enumerate(lines) if needle in l]
    if hits:
        print(needle, hits[:10], "count", text.count(needle))
