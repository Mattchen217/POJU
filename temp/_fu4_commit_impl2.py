import subprocess
from pathlib import Path
cwd = r"D:\POJU\pojulife"
files = [
    r"lib/poju/decision-intake/types.ts",
    r"lib/poju/decision-intake/pending-answer-resolution.ts",
    r"lib/poju/decision-intake/adaptive-turn.ts",
    r"scripts/test-m1-production-adaptive-question-loop.ts",
]
r = subprocess.run(["git", "add", "--"] + files, cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print("add", r.returncode, r.stderr)
names = subprocess.run(["git", "diff", "--cached", "--name-only"], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace").stdout.splitlines()
print("staged", names)
allowed = {f.replace("\\", "/") for f in files}
unexpected = [n for n in names if n.replace("\\", "/") not in allowed]
if unexpected:
    raise SystemExit("unexpected staged: " + repr(unexpected))
r = subprocess.run(["git", "commit", "-F", r"D:\POJU\pojulife\temp\COMMIT_MSG_R2FU4_IMPL.txt"], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print("commit", r.returncode)
print(r.stdout)
print(r.stderr)
r = subprocess.run(["git", "rev-parse", "HEAD"], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print("HEAD", r.stdout.strip())
r = subprocess.run(["git", "rev-parse", "HEAD^"], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print("PARENT", r.stdout.strip())
