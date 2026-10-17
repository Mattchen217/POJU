import sys
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html", "r", encoding="utf-8") as f:
    lines = f.readlines()
print("=== desktop click 3515-3545 ===")
for i in range(3514, 3545):
    print(f"{i+1}|{lines[i].rstrip()}")
# any prior A1 or PASS secondary references in temp notes
print("\n=== searching trust apply ===")
for i, line in enumerate(lines):
    if "hero-trust" in line or "heroTrust" in line or "trustBadge" in line:
        print(f"{i+1}|{line.rstrip()[:200]}")
