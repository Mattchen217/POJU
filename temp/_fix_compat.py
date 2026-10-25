import pathlib
import subprocess

files = [
    "day-master-interaction.ts",
    "yong-shen-match.ts",
    "branch-interactions.ts",
    "spouse-star.ts",
    "shensha-resonance.ts",
    "luck-cycle-sync.ts",
]

replacements = [
    ("from '../data/stems-branches'", "from '@/lib/calendar/data/stems-branches'"),
    ('from "../data/stems-branches"', 'from "@/lib/calendar/data/stems-branches"'),
    ("from '../data/branch-relations'", "from '@/lib/calendar/data/branch-relations'"),
    ('from "../data/branch-relations"', 'from "@/lib/calendar/data/branch-relations"'),
    ("from '../data/shensha'", "from '@/lib/calendar/data/shensha'"),
    ('from "../data/shensha"', 'from "@/lib/calendar/data/shensha"'),
]

for name in files:
    content = subprocess.check_output(
        ["git", "show", f"HEAD:lib/match/calculations/{name}"],
        cwd=".",
    )
    text = content.decode("utf-8")
    for a, b in replacements:
        text = text.replace(a, b)
    dest = pathlib.Path("lib/compatibility/calculations") / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text, encoding="utf-8", newline="\n")
    print("wrote", dest)

content = subprocess.check_output(
    ["git", "show", "HEAD:lib/match/parse-profile-for-matrix.ts"],
    cwd=".",
)
text = content.decode("utf-8").replace(
    'from "./data/stems-branches"',
    'from "@/lib/calendar/data/stems-branches"',
)
pathlib.Path("lib/compatibility/parse-profile-for-matrix.ts").write_text(
    text, encoding="utf-8", newline="\n"
)

content = subprocess.check_output(
    ["git", "show", "HEAD:lib/match/calculate-compatibility.ts"],
    cwd=".",
)
pathlib.Path("lib/compatibility/calculate-compatibility.ts").write_text(
    content.decode("utf-8"), encoding="utf-8", newline="\n"
)
print("compat restored")
