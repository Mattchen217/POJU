import re, sys
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html", "r", encoding="utf-8") as f:
    html = f.read()
# find quote assignment in team rendering
for m in re.finditer(r".{0,40}(\.quote|quoteEl|member\.q|quotes\[).{0,100}", html):
    s = m.group(0).replace("\n", " ")
    if "textContent" in s or "innerHTML" in s or "quote" in s.lower():
        if "TEAM" in html[max(0,m.start()-2000):m.start()+200] or "team" in s.lower() or "member" in s.lower():
            print(repr(s[:200]))
            print("---")
# specifically search team quote application
idx = html.find("TEAM_MEMBERS")
if idx < 0:
    idx = html.find("teamMembers")
print("TEAM_MEMBERS idx", idx)
area = html[144000:175000]
for pat in ["textContent = ", "innerHTML = ", ".quote", "quoteEl", "qEl"]:
    c = area.count(pat)
    if c:
        print(pat, c)
# dump lines with quote and textContent/innerHTML in team section
for i, line in enumerate(area.splitlines()):
    if ("quote" in line.lower() or "bio" in line.lower()) and ("textContent" in line or "innerHTML" in line):
        print(i, line.strip()[:180])
