# Test file structure: helpers, Case G, session reload, handleUserMessage
path = "scripts/test-m1-production-adaptive-question-loop.ts"
lines = open(path, encoding="utf-8").read().splitlines()
print("total", len(lines))
# print function defs and case labels
for i,l in enumerate(lines,1):
    if (
        l.startswith("async function") or l.startswith("function ") or l.startswith("export ")
        or "Case G" in l or "FU1" in l or "m24r2g" in l or "handleUserMessage" in l
        or "reload" in l.lower() or "JSON.parse" in l or "createPOJUSession" in l
        or "runCase" in l or "CASE" in l and ("function" in l or "====" in l or "log" in l[:40])
        or l.strip().startswith("// Case") or l.strip().startswith("// FU")
        or "pending" in l.lower()
    ):
        print(f"{i:4d}: {l}")
