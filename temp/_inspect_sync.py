path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    t = f.read()
for needle in ["syncHeroCtas()", "syncHeroCtas("]:
    start = 0
    while True:
        i = t.find(needle, start)
        if i < 0:
            break
        line = t.count("\n", 0, i) + 1
        print(line, repr(t[i:i+80]))
        start = i + 1
print("--- ctaByOs windows in es/fr ---")
idx = 0
while True:
    i = t.find("windows:", idx)
    if i < 0:
        break
    line = t.count("\n", 0, i) + 1
    if 2610 <= line <= 2720:
        print(line, t[i:i+90].replace("\n", " "))
    idx = i + 1
