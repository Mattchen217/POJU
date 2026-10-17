import re
from pathlib import Path
from collections import Counter
text = Path("public/v2-landing.html").read_text(encoding="utf-8")
keys = ["$4.99","$9.99","$29.99","Five Specialized","Five Engines","Monthly Pass","all 5 products","Five</span> Specialized","Unstick it","破开它","$19.99","$59.99"]
print("SHA check file greps:")
for k in keys:
    print(f"  {k!r}: {text.count(k)}")
print("  prices:", Counter(re.findall(r"\$\d+\.\d{2}", text)))
print("  eos-landing-v2-top id:", text.count('id="eos-landing-v2-top"'))
print("  #eos-landing-v2-top css:", text.count("#eos-landing-v2-top"))
