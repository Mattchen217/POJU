import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    lines = f.read().splitlines(True)

# Find section end lines by tracking tags after known starts
def find_close(start_idx, tag):
    # start_idx is 0-based line with opening tag
    open_re = f"<{tag}"
    close_re = f"</{tag}>"
    depth = 0
    for i in range(start_idx, len(lines)):
        l = lines[i]
        # count opens (not self-closing carefully)
        opens = 0
        closes = 0
        j = 0
        low = l.lower()
        while True:
            a = low.find(f"<{tag}", j)
            b = low.find(f"</{tag}>", j)
            if a < 0 and b < 0:
                break
            if a >= 0 and (b < 0 or a < b):
                # check not comment
                opens += 1
                j = a + 1
            else:
                closes += 1
                j = b + 1
        depth += opens - closes
        if depth <= 0 and i > start_idx:
            return i
    return None

markers = {
    "v2-hero": 1921,
    "v2-scenarios": 2100,
    "v2-product-preview": 2127,
    "v2-engines": 2150,
    "v2-pricing": 2370,
    "v2-faq": 2452,
}
for name, idx in markers.items():
    tag = "main" if name == "v2-hero" else "section"
    end = find_close(idx, tag)
    print(f"{name}: start={idx+1} end={end+1 if end is not None else None} tag={tag}")
    if end is not None:
        print("  start:", lines[idx].strip()[:100])
        print("  end:", lines[end].strip()[:100])

# what is between hero end and scenarios?
print("\nAfter hero main to scenarios:")
for i in range(1944, 2105):
    s = lines[i].strip()
    if s and (s.startswith("<") or "id=" in s or s.startswith("//") or s.startswith("function") or s.startswith("</")):
        if any(x in s for x in ["section", "main", "script", "id=", "</", "<!--", "function ", "const "]):
            print(f"{i+1}: {s[:130]}")
