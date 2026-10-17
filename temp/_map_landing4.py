import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    lines = f.read().splitlines(True)

# Dump 2250-2545 with only structural / price / product lines
for i in range(2249, 2545):
    s = lines[i].rstrip()
    keep = False
    for k in ["section", "footer", "id=", "$4.", "$29.", "$19.", "$9.", "Glyph", "Syncro", "Match", "Atmos", "Pivot", "Five", "Monthly", "Pass", "engines", "pricing", "faq", "gateway", "trust", "<!--", "script"]:
        if k.lower() in s.lower() or k in s:
            keep = True
            break
    if keep or (s.strip().startswith("</") and len(s.strip()) < 20):
        print(f"{i+1}: {s.strip()[:140]}")

print("\n--- FAQ region raw 2453-2544 ---")
for i in range(2452, 2544):
    print(f"{i+1}: {lines[i].rstrip()[:140]}")
