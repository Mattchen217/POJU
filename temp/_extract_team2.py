import subprocess, re
raw = subprocess.check_output(["git", "show", "188dad4:public/v2-landing.html"])
content = raw.decode("utf-8")
m1 = re.search(r"(            const TEAM_AVATARS = \[.*?\];)\n", content, re.S)
m2 = re.search(r"(            const TEAM_COPY = \{.*?\n            \};)\n", content, re.S)
assert m1 and m2
avatars = m1.group(1)
team_copy = m2.group(1)
# top-level locale keys
keys = re.findall(r"^\s{14}([a-z]{2}):\s*\{", team_copy, re.M)
print("locale keys:", keys)
print("Max C. count", team_copy.count("Max C."))
print("team: count", team_copy.count("team:"))
# member names
for name in ["Max C.", "Maya", "Marcus", "Elena", "Arthur"]:
    print(name, team_copy.count(name))
lines = content.splitlines()
for i, l in enumerate(lines):
    if any(x in l for x in ("const TEAM_AVATARS", "const TEAM_COPY", "function renderTeamCard", "const ENGINE_COPY", "function applyTeamCopy", "function applyEngineCopy")):
        print(f"{i+1}: {l.strip()[:90]}")
open("temp/_team_avatars.js", "w", encoding="utf-8", newline="\n").write(avatars + "\n\n")
open("temp/_team_copy.js", "w", encoding="utf-8", newline="\n").write(team_copy + "\n\n")
# also write combined insert block
block = avatars + "\n\n" + team_copy + "\n\n"
open("temp/_team_insert.js", "w", encoding="utf-8", newline="\n").write(block)
print("TEAM_COPY_LEN", len(team_copy))
print("wrote ok")
