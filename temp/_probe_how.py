from pathlib import Path
import re
t = Path(r"D:/POJU/pojulife/public/v2-landing.html").read_text(encoding="utf-8")
a = t.find('id="eos-landing-how-get"')
print("section", a, "line", t.count("\n", 0, a) + 1)
b = t.find('id="v2-team-section"', a)
snip = t[a:b]
Path(r"D:/POJU/pojulife/temp/_how_get_sec.txt").write_text(snip, encoding="utf-8")
print("sec len", len(snip))
print("--- first 2500 ---")
print(snip[:2500])
c = t.find("HOW_GET_COPY")
print("HOW_GET_COPY line", t.count("\n", 0, c) + 1)
print(t[c:c+2200])
