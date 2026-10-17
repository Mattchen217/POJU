# -*- coding: utf-8 -*-
import sys, re
sys.stdout.reconfigure(encoding="utf-8")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Find currentLocale assignment and apply* calls together
for needle in ["applyBuiltCopy(", "applyEngineCopy(", "applyTeamCopy(", "applyFaqCopy(", "applyPricingCopy(", "applyHero", "currentLocale ="]:
    for m in re.finditer(re.escape(needle), text):
        print(f"{needle} @ {m.start()}")
        print(text[m.start()-80:m.start()+120].replace("\n"," "))
        print("---")

# EOS_SCENARIOS_COPY structure snippet
idx = text.find("EOS_SCENARIOS_COPY")
print("\n=== EOS_SCENARIOS_COPY ===")
print(text[idx:idx+1200])
