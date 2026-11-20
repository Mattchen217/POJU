import base64, subprocess
from pathlib import Path
msg = base64.b64decode("Zml4KG0yLjQpOiBGVTQgY2xhcmlmaWNhdGlvbiBzZW1hbnRpYyBzYWZldHkgYW5kIHRlcm1pbmFsIHBlbmRpbmcgbGlmZW~5Y2xlCgpSZWNvZ25pemUgbmVnYXRpb24gYW5kIHVuY2VydGFpbnR5IGJlZm9yZSBhZmZpcm1hdGlvbiBpbiBwZW5kaW5nCmNsYXJpZmljYXRpb24gcGFyc2Vycy4gQWZ0ZXIgdGhlIGxhc3QgcGVuZGluZyBpdGVtIGlzIHJlZnVzZWQsIGVudGVyIGFuCmV4cGxpY2l0IHRlcm1pbmFsIHJlamVjdGVkIHN0YXRlLCBjbGVhciB0aGUgb2xkIGNsYXJpZmljYXRpb25fcGxhbiwga2VlcAphbiBhdWRpdGFibGUgcmVqZWN0aW9uIHJlY29yZCB0aGF0IGlzIG5vdCBhIERDIGZhY3QsIGFuZCBhbGxvdyBmb3JtYWwKaW52ZXN0aWdhdGlvbiB0byBwbGFuIHRoZSBuZXh0IGxlZ2FsIE5lZWRJdGVtLiBBZGQgRlU0LUEtRSwgbmVnYXRpb24KcHJvZHVjdGlvbi1wYXRoIGNhc2VzLCBhbmQgdGVybWluYWwtcmVzdW1lIGNvdmVyYWdlIHRocm91Z2gKaGFuZGxlVXNlck1lc3NhZ2UoKS4K").decode()
msg_path = Path(r"D:\POJU\pojulife\temp\COMMIT_MSG_R2FU4_IMPL.txt")
msg_path.write_text(msg, encoding="utf-8", newline="\n")
files = [
    r"lib/poju/decision-intake/types.ts",
    r"lib/poju/decision-intake/pending-answer-resolution.ts",
    r"lib/poju/decision-intake/adaptive-turn.ts",
    r"scripts/test-m1-production-adaptive-question-loop.ts",
]
cwd = r"D:\POJU\pojulife"
r = subprocess.run(["git", "add", "--"] + files, cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print("add", r.returncode, r.stdout, r.stderr)
r = subprocess.run(["git", "diff", "--cached", "--stat"], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print("cached", r.stdout)
# refuse if unexpected files staged
cached_names = subprocess.run(["git", "diff", "--cached", "--name-only"], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace").stdout.splitlines()
print("staged", cached_names)
allowed = set(f.replace("\\", "/") for f in files)
unexpected = [n for n in cached_names if n.replace("\\", "/") not in allowed]
if unexpected:
    raise SystemExit("unexpected staged: " + repr(unexpected))
r = subprocess.run(["git", "commit", "-F", str(msg_path)], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print("commit", r.returncode)
print(r.stdout)
print(r.stderr)
r = subprocess.run(["git", "rev-parse", "HEAD"], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace")
print("HEAD", r.stdout.strip())
