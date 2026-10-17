from pathlib import Path
cur = Path("public/v2-landing.html").read_text(encoding="utf-8", errors="replace")
idx = cur.find(".v2-price-card.is-featured:hover")
print("idx", idx)
print(repr(cur[idx-200:idx+200]))
# also find transform: none near end of style for price
idx2 = cur.find("v2-price-card.is-featured:hover")
# find all
start = 0
while True:
    i = cur.find("v2-price-card.is-featured", start)
    if i < 0: break
    print("---", i)
    print(repr(cur[i:i+180]))
    start = i + 1
