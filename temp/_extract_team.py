import subprocess, re
raw = subprocess.check_output(["git", "show", "188dad4:public/v2-landing.html"])
content = raw.decode("utf-8")
m1 = re.search(r"(            const TEAM_AVATARS = \[.*?\];)\n", content, re.S)
m2 = re.search(r"(            const TEAM_COPY = \{.*?\n            \};)\n", content, re.S)
assert m1 and m2, (bool(m1), bool(m2))
avatars = m1.group(1)
team_copy = m2.group(1)
for i in range(1, 6):
    p = f"/v2/touxiang{i}.png"
    assert p in avatars, p
print("AVATARS_OK")
print(avatars)
for loc in ["zh", "en", "ja", "ko", "fr"]:
    assert re.search(rf"\b{loc}\s*:", team_copy), loc
assert "section_title" in team_copy
assert "section_subtitle" in team_copy
assert "team:" in team_copy
assert "Max C." in team_copy
print("TEAM_COPY_OK", len(team_copy))
lines = content.splitlines()
for i, l in enumerate(lines):
    if any(x in l for x in ("const TEAM_AVATARS", "const TEAM_COPY", "function renderTeamCard", "const ENGINE_COPY", "function applyTeamCopy", "function applyEngineCopy")):
        print(f"{i+1}: {l.strip()[:90]}")
open("temp/_team_avatars.js", "w", encoding="utf-8", newline="\n").write(avatars + "\n\n")
open("temp/_team_copy.js", "w", encoding="utf-8", newline="\n").write(team_copy + "\n\n")
print("wrote ok")
