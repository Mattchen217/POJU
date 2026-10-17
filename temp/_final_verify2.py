import sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
lines = Path("public/v2-landing.html").read_text(encoding="utf-8").splitlines()
for i in [2001, 2999, 418, 424, 435, 441, 444, 2289, 2291, 2296, 2326, 2626]:
    if 0 <= i < len(lines):
        print(f"{i+1}: {lines[i].strip()[:160]}")
# also grep Five Specialized variants and $ patterns one more time
text = Path("public/v2-landing.html").read_text(encoding="utf-8")
import re
print("Five Specialized", len(re.findall(r'Five\s*Specialized', text)))
print("Five.*Engines html", len(re.findall(r'Five</span>\s*Specialized', text)))
print("bad prices", re.findall(r'\$(?!19\.99|59\.99)\d+\.\d{2}', text))
