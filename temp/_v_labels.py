from pathlib import Path
import re
t = Path(r"D:/POJU/pojulife/public/v2-landing.html").read_text(encoding="utf-8")
block = t[t.find("HOW_GET_COPY"):t.find("HOW_GET_COPY")+9000]
zh = block[block.find("zh:"):]
print("EN labels:")
for m in re.finditer(r'"stage\d\.label": "[^"]+"', block[:block.find("zh:")]):
    print(m.group(0))
print("ZH labels:")
for m in re.finditer(r'"stage\d\.label": "[^"]+"', zh[:4000]):
    print(m.group(0))
print("01 leftovers in how-get section:", "\">01<" in t[t.find('id="eos-landing-how-get"'):t.find('id="v2-team-section"')])
print("arrow count", t.count("eos-how-get-flash-arrow"))
