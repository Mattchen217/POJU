# -*- coding: utf-8 -*-
from pathlib import Path
import re

path = Path(r"D:\POJU\pojulife\public\v2-landing.html")
text = path.read_text(encoding="utf-8")
original = text

# 1) ZH pricing title
zh_old = '"title": "透明定价，随心选择"'
zh_new = '"title": "透明<span class=\\"gold-gradient\\">定价</span>，随心选择"'
# Also try without escaped quotes in JSON-like JS object (uses regular quotes)
zh_old2 = '"title": "透明定价，随心选择"'
# The file uses JSON-style with escaped? Looking at read: "title": "Clear pricing. Your call."
# So unescaped in the JS object strings.

if zh_old not in text and '透明定价' not in text:
    # dump nearby header titles for debug
    m = re.search(r'"header"\s*:\s*\{\s*"title"\s*:\s*"([^"]*)"', text)
    print("DEBUG first header title repr:", repr(m.group(1) if m else None))
    # find zh header
    idxs = [m.start() for m in re.finditer(r'"title"\s*:\s*"', text)]
    print("title count near pricing:", len(idxs))

# Find PRICING_I18N block
pi = text.find("const PRICING_I18N")
print("PRICING_I18N at", pi)
chunk = text[pi:pi+800]
# extract zh title
mzh = re.search(r'"zh"\s*:\s*\{\s*"header"\s*:\s*\{\s*"title"\s*:\s*"(.*?)"', chunk, re.S)
print("ZH title current:", repr(mzh.group(1) if mzh else None))
men = re.search(r'"en"\s*:\s*\{\s*"header"\s*:\s*\{\s*"title"\s*:\s*"(.*?)"', text[pi:pi+5000], re.S)
# en is later - search in larger window
men = re.search(r'"en"\s*:\s*\{\s*"header"\s*:\s*\{\s*"title"\s*:\s*"([^"]*)"', text[pi:])
print("EN title current:", repr(men.group(1) if men else None))

# isBonusFeature
mbonus = re.search(r'function isBonusFeature\(text\) \{\s*return (/.*?/);', text[pi:pi+8000])
print("isBonusFeature regex:", mbonus.group(1) if mbonus else None)

# icon
micon = re.search(r'id="v2-price-personal"[^>]*>.*?material-symbols-outlined[^>]*>([^<]+)</span>', text, re.S)
print("personal icon:", repr(micon.group(1).strip() if micon else None))

# applyPricingCopy innerHTML check
print("applyPricingCopy uses innerHTML for header:", "el.innerHTML = pack.header[key]" in text or "el.innerHTML = pack.header" in text)
