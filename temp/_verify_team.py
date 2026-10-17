from pathlib import Path
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
checks = [
    ("TEAM_AVATARS", "const TEAM_AVATARS" in t),
    ("TEAM_COPY", "const TEAM_COPY" in t),
    ("TEAM_COPY[locale]", "TEAM_COPY[locale]" in t),
    ("TEAM_AVATARS[i]", "TEAM_AVATARS[i]" in t),
    ("renderTeamCard", "function renderTeamCard" in t),
    ("applyTeamCopy call", "applyTeamCopy(currentLocale)" in t),
    ("v2-team-section", 'id="v2-team-section"' in t),
    ("v2-team-track", 'id="v2-team-track"' in t),
    ("eos-landing-v2-top", "eos-landing-v2-top" in t),
    ("touxiang1", "/v2/touxiang1.png" in t),
    ("touxiang2", "/v2/touxiang2.png" in t),
    ("touxiang3", "/v2/touxiang3.png" in t),
    ("touxiang4", "/v2/touxiang4.png" in t),
    ("touxiang5", "/v2/touxiang5.png" in t),
    ("v2-team-scroll", "v2-team-scroll" in t),
    ("single TEAM_AVATARS", t.count("const TEAM_AVATARS") == 1),
    ("single TEAM_COPY", t.count("const TEAM_COPY") == 1),
]
for name, ok in checks:
    print(("OK" if ok else "FAIL"), name)
assert t.index("const TEAM_AVATARS") < t.index("function applyTeamCopy")
assert t.index("const TEAM_COPY") < t.index("function applyTeamCopy")
assert t.index("function renderTeamCard") < t.index("function applyTeamCopy")
print("ORDER_OK")
# avatar order in TEAM_AVATARS as original
start = t.index("const TEAM_AVATARS")
end = t.index("];", start)
block = t[start:end]
order = [f"/v2/touxiang{i}.png" for i in (1,4,3,2,5)]
positions = [block.index(p) for p in order]
assert positions == sorted(positions), positions
print("AVATAR_ORDER_OK", order)
