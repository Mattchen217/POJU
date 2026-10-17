# -*- coding: utf-8 -*-
from pathlib import Path

path = Path("public/v2-landing.html")
text = path.read_text(encoding="utf-8")
insert = Path("temp/_team_insert.js").read_text(encoding="utf-8")

assert "const TEAM_AVATARS" not in text, "TEAM_AVATARS already present"
assert "const TEAM_COPY" not in text, "TEAM_COPY already present"
assert "function applyTeamCopy(locale)" in text
assert "function renderTeamCard" in text

# Confirm avatar paths in insert
for i in range(1, 6):
    assert f"/v2/touxiang{i}.png" in insert, f"missing touxiang{i}"

marker = "            function applyTeamCopy(locale) {"
idx = text.find(marker)
assert idx != -1
# Insert immediately before applyTeamCopy
new_text = text[:idx] + insert + text[idx:]
path.write_text(new_text, encoding="utf-8", newline="\n")

# Verify
verify = path.read_text(encoding="utf-8")
assert "const TEAM_AVATARS" in verify
assert "const TEAM_COPY" in verify
for i in range(1, 6):
    assert f"/v2/touxiang{i}.png" in verify
# ensure applyTeamCopy still references them and renderTeamCard exists once
assert verify.count("function applyTeamCopy") == 1
assert verify.count("function renderTeamCard") == 1
assert verify.count("const TEAM_AVATARS") == 1
assert verify.count("const TEAM_COPY") == 1
# eos-landing-v2-top still present
assert "eos-landing-v2-top" in verify
# team section
assert 'id="v2-team-section"' in verify
assert 'id="v2-team-track"' in verify
print("PATCH_OK")
# show line numbers
for i, line in enumerate(verify.splitlines(), 1):
    if "const TEAM_AVATARS" in line or "const TEAM_COPY" in line or "function applyTeamCopy" in line:
        if "TEAM_AVATARS" in line or line.strip().startswith("const TEAM_COPY") or "function applyTeamCopy" in line:
            print(f"{i}: {line.strip()[:100]}")
# print TEAM_AVATARS block
start = verify.index("const TEAM_AVATARS")
end = verify.index("];", start) + 2
print("---AVATARS---")
print(verify[start:end])
