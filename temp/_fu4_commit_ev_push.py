import subprocess
cwd = r"D:\POJU\pojulife"
file = r"docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask/CONTRACT-M2-4-R2-FU4.md"
msg = r"D:\POJU\pojulife\temp\COMMIT_MSG_R2FU4_EV.txt"
r = subprocess.run(["git", "add", "--", file], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print("add", r.returncode, r.stderr)
names = subprocess.run(["git", "diff", "--cached", "--name-only"], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace").stdout.splitlines()
print("staged", names)
if names != [file.replace("\\", "/")]:
    raise SystemExit("unexpected staged: " + repr(names))
r = subprocess.run(["git", "commit", "-F", msg], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print("commit", r.returncode)
print(r.stdout)
print(r.stderr)
for arg in ["HEAD", "HEAD^", "HEAD^^"]:
    r = subprocess.run(["git", "rev-parse", arg], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
    print(arg, r.stdout.strip())
r = subprocess.run(["git", "log", "-2", "--format=%h %s"], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print(r.stdout)
r = subprocess.run(["git", "rev-list", "--left-right", "--count", "15ab21e2d3b1c08b7b742f87f4f773742ededc2e...HEAD"], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print("behind-ahead vs 15ab21e2", r.stdout.strip())
r = subprocess.run(["git", "push", "origin", "HEAD:feat/m1-r-fresh-session-main-loop"], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print("push", r.returncode)
print(r.stdout)
print(r.stderr)
