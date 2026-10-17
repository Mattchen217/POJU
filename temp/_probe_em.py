path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
import re
for m in re.finditer(r".{0,80}<em>.{0,100}</em>.{0,40}", text):
    print("---")
    print(m.group(0))
