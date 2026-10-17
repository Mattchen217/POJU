from pathlib import Path
import re
path = Path(r"D:/POJU/pojulife/public/v2-landing.html")
text = path.read_text(encoding="utf-8")
a = text.find('id="eos-landing-how-get"')
b = text.find('id="v2-team-section"', a)
sec = text[a:b]
# find what-you-get strip: border-t through close, before CTA
# print markers
for needle in ["listH3", "item1", "eos-how-get-cta", "What you walk away", "border-t border-white/10", "border-t border-slate"]:
    print(needle, sec.find(needle))
# show from border-t near get section
idx = sec.find("listH3")
print("--- around listH3 ---")
print(sec[max(0,idx-400):idx+1200])
