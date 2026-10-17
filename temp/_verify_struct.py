import sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
text = Path("public/v2-landing.html").read_text(encoding="utf-8")
lines = text.splitlines(True)
print("has <style>", "<style" in text)
print("has </style>", "</style>" in text)
print("has <head>", "<head" in text)
# count style-related
for i,l in enumerate(lines):
    if "<style" in l or "</style>" in l or "<head" in l or "</head>" in l or "<body" in l or 'id="eos-landing-v2-top"' in l or "<nav" in l:
        print(f"{i+1}: {l.strip()[:120]}")
# show first 30 lines and around eos top
print("--- first 20 ---")
for i in range(20):
    print(f"{i+1}: {lines[i].rstrip()[:100]}")
print("--- search #eos-landing-v2-top css ---")
print("css refs", text.count("#eos-landing-v2-top"))
print("--- prices leftover ---")
for p in ["$29.90","$59.90","$5.98","$4.27","Atmos","Syncro","Glyph"]:
    print(p, text.count(p))
# PRICING still there?
print("PRICING_I18N", "PRICING_I18N" in text)
print("v2-method", "v2-method" in text or "v2-built" in text)
print("v2-team", "v2-team" in text)
