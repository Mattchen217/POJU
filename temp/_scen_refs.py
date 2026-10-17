from pathlib import Path
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
# any remaining v2-scenarios refs
idxs = []
start = 0
while True:
    i = t.find("v2-scenarios", start)
    if i < 0:
        break
    idxs.append(i)
    start = i + 1
print("refs", len(idxs))
for i in idxs[:20]:
    print(repr(t[max(0,i-40):i+80]))
