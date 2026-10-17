path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    t = f.read()
# find v2-lang-opt click handlers
i = t.find("v2-lang-opt")
# find all occurrences with context after language switcher setup
idx = 0
count = 0
while count < 20:
    i = t.find("v2-lang", idx)
    if i < 0: break
    line = t.count("\n", 0, i) + 1
    if line > 3500:
        print(line, t[i:i+120].replace("\n"," | "))
        count += 1
    idx = i + 1
print("done count", count)
# search for lang-btn listener near end
for needle in ["v2-lang-btn", "data-locale", "goLocale", "setLocale", "lang-menu"]:
    idx = 0
    while True:
        i = t.find(needle, idx)
        if i < 0: break
        line = t.count("\n", 0, i) + 1
        if line > 3600:
            print("N", needle, line, repr(t[i:i+100]))
        idx = i + 1
