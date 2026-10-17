import re
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
lines = text.splitlines(True)
print("lines", len(lines), "chars", len(text))
keys = [
    "eos-landing-v2-top",
    'id="v2-hero"',
    'id="v2-scenarios"',
    'id="v2-product-preview"',
    'id="v2-engines"',
    'id="v2-pricing"',
    "</footer>",
    "<footer",
    "</main>",
    'id="v2-faq"',
    "Five Specialized",
    "Five Engines",
    "$4.99",
    "$29.99",
    "$9.99",
    "$3.99",
    "$2.99",
    "PASS_UNIT",
    "all 5 products",
    "Monthly Pass",
    "Unstick it",
    "破开它",
]
for k in keys:
    hits = []
    for i, l in enumerate(lines, 1):
        if k in l:
            hits.append((i, l.strip()[:120]))
    print(f"=== {k!r} ({len(hits)}) ===")
    for i, s in hits[:20]:
        print(f"{i}: {s}")
