import re, sys
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html", "r", encoding="utf-8") as f:
    html = f.read()
start = html.find("const TEAM_COPY")
brace = html.find("{", start)
i = brace
depth = 0
while i < len(html):
    c = html[i]
    if c == "{": depth += 1
    elif c == "}":
        depth -= 1
        if depth == 0:
            end = i + 1
            break
    i += 1
obj = html[brace:end]
# write full object as utf-8
with open("public/_team_obj.js", "w", encoding="utf-8") as f:
    f.write(obj)
print("wrote", len(obj))
# show structure - first 80 lines of keys
for line in obj.splitlines()[:120]:
    print(line[:200])
