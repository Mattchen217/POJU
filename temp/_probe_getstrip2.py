from pathlib import Path
path = Path(r"D:/POJU/pojulife/public/v2-landing.html")
text = path.read_text(encoding="utf-8")
a = text.find('id="eos-landing-how-get"')
b = text.find('id="v2-team-section"', a)
sec = text[a:b]
start = sec.find('<div class="mt-16 md:mt-20 pt-12 md:pt-16 border-t border-slate-200/50 dark:border-white/10">')
cta = sec.find('eos-how-get-cta')
print("start", start, "cta", cta)
print(sec[start:cta+500])
