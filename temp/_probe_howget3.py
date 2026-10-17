# -*- coding: utf-8 -*-
import sys, re
sys.stdout.reconfigure(encoding="utf-8")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("eos-section-gap")
print("=== more gap CSS ===")
print(text[idx:idx+1800])
print("\n=== Technical Specs snippet ===")
idx2 = text.find("Technical Spec")
print(text[idx2-400:idx2+1200])
