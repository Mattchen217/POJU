# -*- coding: utf-8 -*-
import sys, re
sys.stdout.reconfigure(encoding="utf-8")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Find methodology section end and what follows until pricing
m = re.search(r'id=["\']v2-methodology["\']', text)
# find opening tag start
open_start = text.rfind("<section", 0, m.start())
print("=== methodology open snippet ===")
print(text[open_start:open_start+200])
print()

# Find next section after methodology
# Walk to find matching close - heuristic: find v2-team-section
t = text.find('id="v2-team-section"')
print("team-section at", t)
team_open = text.rfind("<section", 0, t)
print("=== between methodology mid and team ===")
# print last 800 chars before team section
print(text[team_open-900:team_open+250])
print()
print("=== eos-section-gap CSS context ===")
idx = text.find("eos-section-gap")
print(text[idx-200:idx+600])
