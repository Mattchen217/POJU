import sys,re
from collections import Counter
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
text = Path("public/v2-landing.html").read_text(encoding="utf-8")
lines = text.splitlines(True)
print("lines", len(lines), "chars", len(text))
for needle in ["Atmos", "Pivot", "Match", "Syncro", "Glyph", "ATMOS", "PIVOT", "MATCH", "SYNCRO", "GLYPH", "tab=atmos", "Begin Atmos", "Five", "Specialized", "$4.99", "$29.99", "$9.99"]:
    hits = [(i+1, l.strip()[:140]) for i,l in enumerate(lines) if needle in l]
    if hits:
        print(f"\n=== {needle} ({len(hits)}) ===")
        for h in hits[:15]:
            print(f"{h[0]}: {h[1]}")
print("\n=== essential ===")
for k in ["eos-landing-v2-top", "v2-lang-switcher", "v2-faq", "v2-built-heading", "v2-auth-modal", "Unstick it", "$19.99", "$59.99", "Open App"]:
    print(k, text.count(k))
print("破开它", "破开它" in text)
print("price tokens:", Counter(re.findall(r"\$\d+\.\d{2}", text)))
