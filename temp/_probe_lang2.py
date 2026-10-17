from pathlib import Path
text = Path("public/v2-landing.html").read_text(encoding="utf-8")
# find v2-lang-opt click handler
i = text.find("v2-lang-opt")
# find JS that handles locale option click
j = text.find("data-locale")
print("first data-locale", j)
# search for lang menu click
for needle in [".v2-lang-opt", "lang-menu", "UI_LOCALE", "location.pathname"]:
    start = 0
    c = 0
    while c < 5:
        k = text.find(needle, start)
        if k < 0: break
        print(needle, k, repr(text[k:k+120].replace("\n"," | ")))
        start = k + 1
        c += 1
