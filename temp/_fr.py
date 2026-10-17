# -*- coding: utf-8 -*-
with open("public/v2-landing.html", "r", encoding="utf-8") as f:
    html = f.read()
start = html.find("const TEAM_COPY")
brace = html.find("{", start)
i = brace
depth = 0
while i < len(html):
    if html[i] == "{":
        depth += 1
    elif html[i] == "}":
        depth -= 1
        if depth == 0:
            end = i + 1
            break
    i += 1
obj = html[brace:end]
idx = obj.find("fr:")
b = obj.find("{", idx)
d = 0
j = b
fr = None
while j < len(obj):
    if obj[j] == "{":
        d += 1
    elif obj[j] == "}":
        d -= 1
        if d == 0:
            fr = obj[b : j + 1]
            break
    j += 1
with open("public/_fr_block.js", "w", encoding="utf-8") as out:
    out.write(fr)
print("fr len", len(fr))
for f in ["déterministe", "cycles environnementaux", "contrôle cognitif", "confiance", "détermin", "environnement", "cognitif"]:
    if f in fr:
        print("HIT", f)
print(fr)
