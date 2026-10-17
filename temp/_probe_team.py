import re, sys
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html", "r", encoding="utf-8") as f:
    html = f.read()
idx = html.find("TEAM_COPY")
chunk = html[idx:idx+25000]
with open("temp/_team_copy_extract.txt", "w", encoding="utf-8") as out:
    out.write(chunk[:20000])
print("wrote extract")
for sid in ["v2-team-title", "v2-team-subtitle"]:
    m = re.search(rf'id="{sid}"[^>]*>(.*?)</', html, re.S)
    if m:
        print(sid + ":", repr(m.group(1)[:300]))
    else:
        print(sid, "not found")
# quote injection near team apply
area = html[html.find("TEAM_COPY"):html.find("TEAM_COPY")+40000]
for m in re.finditer(r".{0,60}(textContent|innerHTML).{0,80}", area):
    s = m.group(0).replace("\n", " ")
    if "quote" in s.lower() or "subtitle" in s.lower() or "title" in s.lower() or "team" in s.lower():
        print("INJ:", s[:180])
# forbidden in TEAM_COPY region - find object end roughly
# check locales present
for loc in ["en:", "zh:", "es:", "fr:"]:
    print("has", loc, loc in chunk[:5000] or ("  " + loc) in chunk)
