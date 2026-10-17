# -*- coding: utf-8 -*-
from pathlib import Path
path = Path("public/v2-landing.html")
text = path.read_text(encoding="utf-8")
old = (
    "            /* PASS pricing copy lives in #eos-landing-v2-top (EOS_LANDING_V2_I18N).\n"
    "               Old 3-card PRICING_I18N (monthly / family / multi-SKU) removed. */\n"
)
new = (
    "            /* PASS pricing copy lives in #eos-landing-v2-top (EOS_LANDING_V2_I18N).\n"
    "               Old 3-card PRICING_I18N object removed — PASS-only lock. */\n"
)
if old not in text:
    raise SystemExit("comment block not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print("comment updated")
# final greps
text = path.read_text(encoding="utf-8")
for p in ["/month", "per month", "每月", "任意产品", "monthly", "Family /", "全站任意"]:
    print(repr(p), text.count(p))
