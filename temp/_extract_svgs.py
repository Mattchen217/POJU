from pathlib import Path
import re
text = Path("public/v2-landing.html").read_text(encoding="utf-8")
# extract SVGs from v2-scenarios strip
m = re.search(r'<section id="v2-scenarios".*?</section>', text, re.S)
svgs = re.findall(r'<svg[^>]*>.*?</svg>', m.group(0), re.S)
print("found", len(svgs), "svgs")
for i, s in enumerate(svgs):
    print(f"--- svg {i} len={len(s)} ---")
    print(s[:200])
