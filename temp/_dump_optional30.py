# -*- coding: utf-8 -*-
from pathlib import Path
import re
text = Path("public/v2-landing.html").read_text(encoding="utf-8")
out = []
# hero subtitle HTML
for m in re.finditer(r'id="v2-hero-subtitle"[^>]*>.*?</p>', text, re.S):
    out.append("HERO HTML:\n" + m.group(0))
# HERO_COPY en/zh subtitle lines
for m in re.finditer(r"subtitle:\s*'([^']*(?:\\'[^']*)*)'", text):
    s = m.group(1)
    if "30" in s or "提醒" in s or "reminder" in s.lower():
        out.append("HERO_COPY subtitle: " + s)
# EOS scenario forks
for m in re.finditer(r"forks:\s*\{[^}]+\}", text, re.S):
    out.append("FORKS JS:\n" + m.group(0))
# HTML desc for forks card
idx = text.find('data-eos-scenario="forks"')
out.append("FORKS HTML desc area:\n" + text[idx:idx+800])
Path("temp/_optional30_dump.txt").write_text("\n\n---\n\n".join(out), encoding="utf-8")
print("wrote", len(out), "chunks")
