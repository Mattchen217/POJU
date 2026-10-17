path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
# find section containing v2-built-heading
h = text.find('id="v2-built-heading"')
# find section start
sec = text.rfind("<section", 0, h)
# find next section after this one
next_sec = text.find("<section", h + 1)
chunk = text[sec:next_sec]
with open(r"temp\_built_section.html", "w", encoding="utf-8") as f:
    f.write(chunk)
print("section len", len(chunk))
# also find applyBuilt or data-built usage
import re
attrs = re.findall(r'data-built="([^"]+)"', chunk)
print("data-built attrs", attrs)
ids = re.findall(r'id="(v2-built[^"]*)"', chunk)
print("ids", ids)
# how gold-gradient / strong / em used in BUILT_COPY and section
print("strong count", chunk.count("<strong"), "em count", chunk.count("<em"), "gold-gradient", chunk.count("gold-gradient"), "b count", chunk.count("<b>"))
