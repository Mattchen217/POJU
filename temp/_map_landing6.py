import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    lines = f.read().splitlines(True)

for needle in ["ENGINES_SECTION_COPY", "ENGINE_COPY", "enginesCopy", "window.V2_FAQ", "V2_FAQ_I18N", "const FAQ", "applyEngines", "applyHero", "HERO_COPY", "function applyLocale", "Atmos", "Pivot", "MATCH", "SYNCRO", "GLYPH"]:
    hits = [(i+1, l.strip()[:100]) for i,l in enumerate(lines) if needle in l]
    if hits:
        print(f"\n=== {needle} ({len(hits)}) ===")
        for h in hits[:15]:
            print(f"{h[0]}: {h[1]}")

# dump 3080-3280 and 3600-3650 and 3280-3320
print("\n----- 3070-3280 -----")
for i in range(3069, min(3280, len(lines))):
    print(f"{i+1}: {lines[i].rstrip()[:140]}")
