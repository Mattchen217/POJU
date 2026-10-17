# -*- coding: utf-8 -*-
"""Remove dead PRICING_I18N + monthly/family pricing UI wiring from v2-landing.html."""
from pathlib import Path
import re

path = Path("public/v2-landing.html")
text = path.read_text(encoding="utf-8")
original = text

# 1) Replace PASS_UNIT ... plusBtn listeners block with noop applyPricingCopy
# Anchor: from "const PASS_UNIT = 19.99;" through the plusBtn listener, before AUTH modal comment
pat1 = re.compile(
    r"            const PASS_UNIT = 19\.99;.*?            if \(plusBtn\) plusBtn\.addEventListener\('click', \(\) => setPassQty\(passQty \+ 1\)\);\n"
    r"            if \(modalClose\) modalClose\.addEventListener\('click', \(\) => closeUpsell\(\)\);\n\n",
    re.DOTALL,
)
repl1 = (
    "            /* PASS pricing copy lives in #eos-landing-v2-top (EOS_LANDING_V2_I18N).\n"
    "               Old 3-card PRICING_I18N (monthly / family / multi-SKU) removed. */\n"
    "            function applyPricingCopy(locale) { /* no-op: pricing cards purged */ }\n\n"
)
m1 = pat1.search(text)
if not m1:
    raise SystemExit("BLOCK1 not found: PASS_UNIT .. modalClose")
text = pat1.sub(repl1, text, count=1)

# 2) Remove dead modal/buy/personal/family handlers before applyPricingCopy call
pat2 = re.compile(
    r"            if \(modalKeep\) \{.*?            applyPricingCopy\(currentLocale\);\n\n",
    re.DOTALL,
)
repl2 = "            applyPricingCopy(currentLocale);\n\n"
m2 = pat2.search(text)
if not m2:
    raise SystemExit("BLOCK2 not found: modalKeep .. applyPricingCopy")
text = pat2.sub(repl2, text, count=1)

if text == original:
    raise SystemExit("No changes made")

path.write_text(text, encoding="utf-8", newline="\n")
print("patched OK, bytes", len(original), "->", len(text))

# Verify greps
checks = [
    r"/month",
    r"per month",
    r"每月",
    r"任意产品",
    r"全站任意",
    r"Family / Team",
    r"Family /",
    r"personal_plan",
    r"team_plan",
    r"PRICING_I18N",
    r"\$4\.99",
    r"\$9\.99",
    r"\$29\.99",
    r"Five Specialized",
    r"any product",
    r"all products",
]
for pat in checks:
    n = len(re.findall(pat, text))
    print(f"GREP {pat!r}: {n}")

# Allowed prices
for pat in [r"\$19\.99", r"\$59\.99", r"1 PASS", r"5 PASS"]:
    print(f"KEEP {pat!r}: {len(re.findall(pat, text))}")

# Confirm applyPricingCopy still present once as noop + one call
print("applyPricingCopy mentions:", text.count("applyPricingCopy"))
print("eos-landing-v2-top still present:", "eos-landing-v2-top" in text)
