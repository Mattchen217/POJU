from pathlib import Path
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
idxs = []
start = 0
while True:
    i = t.find("#05070a", start)
    if i < 0: break
    idxs.append(i)
    start = i+1
print("count", len(idxs))
for i in idxs:
    print(repr(t[max(0,i-80):i+40]))
