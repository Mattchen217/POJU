# -*- coding: utf-8 -*-
from pathlib import Path
import re
text = Path("public/v2-landing.html").read_text(encoding="utf-8")
lines = []
# find all lines/snippets with 30-day or 30 天同线
for i, line in enumerate(text.splitlines(), 1):
    if "30-day same-line" in line or "30 天同线" in line or "optional 30" in line or "可选 30" in line:
        # ascii-safe: show codepoints around key phrase
        lines.append(f"L{i}: {line.strip()[:200]}")
        # check banned
        if "optional 30" in line or "可选 30" in line:
            lines.append("  *** BAD still present ***")
        if "必含 30" in line:
            lines.append("  *** ZH required ok ***")
        if "plus 30-day" in line or "→ 30-day" in line or "report → 30-day" in line:
            lines.append("  *** EN required ok ***")

Path("temp/_verify_30fix.txt").write_text("\n".join(lines), encoding="utf-8")
# also write unicode escapes for zh snippets
esc = []
for m in re.finditer(r".{0,40}30 天同线提醒.{0,40}", text):
    s = m.group(0)
    esc.append(s.encode("unicode_escape").decode("ascii"))
Path("temp/_verify_30fix_esc.txt").write_text("\n".join(esc), encoding="ascii")
print("lines", len(lines), "esc", len(esc))
print(Path("temp/_verify_30fix_esc.txt").read_text(encoding="ascii"))
