# -*- coding: utf-8 -*-
from pathlib import Path
import re
text = Path("public/v2-landing.html").read_text(encoding="utf-8")

# Find all optional / 可选 related to 30-day
for pat in [r".{0,80}optional 30.{0,80}", r".{0,80}可选 30.{0,80}", r".{0,80}30-day.{0,80}", r".{0,80}30 天.{0,80}"]:
    print("===", pat, "===")
    for m in re.finditer(pat, text, re.I):
        s = m.group(0).replace("\n", " ")
        print(repr(s))
