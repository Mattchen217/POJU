import sys,re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
with open(r"public/v2-landing.html", "r", encoding="utf-8") as f:
    text = f.read()
lines = text.splitlines(True)
for i,l in enumerate(lines):
    if "HERO_COPY" in l or "ENGINES_SECTION" in l:
        print(f"{i+1}: {l.rstrip()[:140]}")
print("--- around 3610-3645 ---")
for i in range(3605, 3650):
    print(f"{i+1}: {lines[i].rstrip()[:140]}")
print("--- around 3405-3430 ---")
for i in range(3405, 3435):
    print(f"{i+1}: {lines[i].rstrip()[:140]}")
