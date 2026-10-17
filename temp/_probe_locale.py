from pathlib import Path
import re
text = Path("public/v2-landing.html").read_text(encoding="utf-8")
# find locale switch / setLocale / currentLocale / lang toggle
for pat in ["currentLocale", "setLocale", "lang-toggle", "data-lang", "applyLocale", "localeChange", "v2-lang"]:
    hits = [(m.start(), text[max(0,m.start()-40):m.start()+60].replace("\n"," ")) for m in re.finditer(pat, text)]
    print(pat, "count", len(hits))
    for h in hits[:8]:
        print(" ", h[0], repr(h[1]))
