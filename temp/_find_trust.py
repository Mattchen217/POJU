import sys
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html", "r", encoding="utf-8") as f:
    content = f.read()
    lines = content.splitlines()
# trust / eyebrow handling
for i, line in enumerate(lines):
    if "v2-hero-trust" in line or "heroTrust" in line or "trust:" in line or ("eyebrow" in line.lower() and "hero" in line.lower()):
        print(f"{i+1}|{line.rstrip()[:200]}")
# pricing / pass section ids
for i, line in enumerate(lines):
    if any(k in line for k in ["id=\"v2-price", "id='v2-price", "id=\"pricing", "#pricing", "id=\"pass", "data-section", "v2-pricing"]):
        if "id=" in line or "href=" in line:
            print(f"SEC {i+1}|{line.rstrip()[:200]}")
# desktop CTA click handler
for i, line in enumerate(lines):
    if "v2-hero-cta-desktop" in line or "desktopCta" in line:
        print(f"CTA {i+1}|{line.rstrip()[:220]}")
