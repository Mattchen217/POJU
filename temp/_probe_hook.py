# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding="utf-8")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
# orchestration block
idx = text.find("applyPricingCopy(currentLocale);")
print(text[idx:idx+500])
print("\n=== after applyFaqCopy - find good insert for HOW_GET_COPY near BUILT_COPY end ===")
idx2 = text.find("function applyBuiltCopy")
print("applyBuiltCopy at", idx2)
# find a spot after applyBuiltCopy function ends to add HOW_GET
print(text[idx2:idx2+450])
