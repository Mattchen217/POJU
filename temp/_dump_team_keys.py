import re, json, sys
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html", "r", encoding="utf-8") as f:
    html = f.read()

# Extract TEAM_COPY object with a brace matcher starting at TEAM_COPY =
start = html.find("const TEAM_COPY")
if start < 0:
    start = html.find("TEAM_COPY")
print("start", start)
# find first {
brace = html.find("{", start)
i = brace
depth = 0
while i < len(html):
    c = html[i]
    if c == "{":
        depth += 1
    elif c == "}":
        depth -= 1
        if depth == 0:
            end = i + 1
            break
    i += 1
obj_src = html[brace:end]
print("obj len", len(obj_src))

# Parse locales roughly with regex for section_subtitle and members
# Dump en/zh/es/fr section_subtitle and each member quote
for loc in ["en", "zh", "es", "fr"]:
    # find loc block: en: { ... },
    m = re.search(rf'\b{loc}\s*:\s*\{{', obj_src)
    if not m:
        print(loc, "MISSING")
        continue
    b = m.end() - 1
    d = 0
    j = b
    while j < len(obj_src):
        if obj_src[j] == "{":
            d += 1
        elif obj_src[j] == "}":
            d -= 1
            if d == 0:
                block = obj_src[b:j+1]
                break
        j += 1
    # section_title, section_subtitle
    for key in ["section_title", "section_subtitle"]:
        km = re.search(rf'{key}\s*:\s*`([^`]*)`|{key}\s*:\s*"((?:\\.|[^"\\])*)"|{key}\s*:\s*\'((?:\\.|[^\'\\])*)\'', block, re.S)
        if km:
            val = km.group(1) or km.group(2) or km.group(3) or ""
            print(f"\n=== {loc}.{key} ===")
            print(val[:500])
    # members quotes - arthur, max, marcus, elena, maya
    for name in ["arthur", "max", "marcus", "elena", "maya", "Arthur", "Max", "Marcus", "Elena", "Maya"]:
        nm = re.search(rf'{name}\s*:\s*\{{([^}}]*(?:\{{[^}}]*\}}[^}}]*)*)\}}', block, re.S | re.I)
        if nm:
            body = nm.group(0)
            qm = re.search(r'quote\s*:\s*`([^`]*)`|quote\s*:\s*"((?:\\.|[^"\\])*)"|quote\s*:\s*\'((?:\\.|[^\'\\])*)\'', body, re.S)
            if qm:
                q = qm.group(1) or qm.group(2) or qm.group(3) or ""
                print(f"\n=== {loc}.{name}.quote ===")
                print(q[:600])

# check forbidden
forb = ["deterministic", "客观确定", "确保你每次", "environmental cycles", "暗涌与周期", "顺势而为", "complete confidence", "cognitive control", "认知控制",
        "determinista", "déterministe", "confianza completa", "ciclos ambientales", "cycles environnementaux", "control cognitivo"]
print("\n=== FORBIDDEN in TEAM_COPY obj ===")
for f in forb:
    if f.lower() in obj_src.lower() or f in obj_src:
        print("FOUND:", f)

# HTML defaults
for sid in ["v2-team-title", "v2-team-subtitle"]:
    m = re.search(rf'id="{sid}"[^>]*>(.*?)</(?:h2|p|div|h[1-6])>', html, re.S)
    if m:
        print(f"\nHTML {sid}:", m.group(1).strip()[:300])

# quote escape pattern
m = re.search(r'.{0,80}escapeHtml\(member\.quote\).{0,80}', html)
if m:
    print("\nescapeHtml context:", m.group(0).replace("\n"," ")[:200])
