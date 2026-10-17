# -*- coding: utf-8 -*-
import re, sys
sys.stdout.reconfigure(encoding="utf-8")
text = open("public/v2-landing.html", encoding="utf-8").read()
hard = ["/month", "/ month", "per month", "Monthly", "每月", "任意产品", "全站任意",
        "Family / Team", "家庭订阅", "家庭/团队", "any product", "all products",
        "Works across", "$4.99", "$9.99", "$29.99", "Five Specialized",
        "personal_plan", "team_plan", "Pass balance resets monthly",
        "订阅套餐", "/ mes", "/ mois"]
print("=== HARD (must be 0) ===")
fail=False
for p in hard:
    n=len(re.findall(re.escape(p) if p.startswith("$") else p, text)) if False else text.count(p)
    # use count for literals
    n = text.count(p)
    status = "OK" if n==0 else "FAIL"
    if n: fail=True
    print(f"{status} {p!r}: {n}")
print("=== ALLOWED ===")
for p in ["$19.99", "$59.99", "1 PASS", "5 PASS", "PRICING_I18N"]:
    print(f"{p!r}: {text.count(p)}")
# show comment line with PRICING_I18N
for i,l in enumerate(text.splitlines()):
    if "PRICING_I18N" in l or "applyPricingCopy" in l:
        print(f"{i+1}: {l.strip()[:120]}")
# productPrice / ctaBody snippets
for i,l in enumerate(text.splitlines()):
    if "productPrice" in l or "ctaBody" in l:
        if "$19.99" in l or "PASS" in l:
            print(f"PRICE {i+1}: {l.strip()[:140]}")
# CRLF check
crlf = text.count("\r\n")
lf = text.count("\n") - crlf
print(f"line endings: CRLF={crlf} LF-only-newlines≈{lf}")
print("FAIL" if fail else "ALL_HARD_ZERO")
