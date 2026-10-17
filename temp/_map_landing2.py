path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    lines = f.read().splitlines(True)

# Find end of eos-landing-v2-top
depth = 0
start = None
for i, l in enumerate(lines):
    if 'id="eos-landing-v2-top"' in l:
        start = i
        depth = 1
        continue
    if start is not None:
        depth += l.count("<div") + l.count("<section") + l.count("<main")
        # rough; better search for closing
print("eos start line", start+1 if start is not None else None)

# print structural lines 1888-1960, 2095-2165, 2245-2380, 2445-2500, 2535-2605, 1888-1925
ranges = [(1885,1960),(2095,2160),(2240,2280),(2320,2380),(2445,2500),(2535,2570),(1888,1925),(2148,2260),(2365,2455)]
for a,b in ranges:
    print(f"\n----- {a}-{b} -----")
    for i in range(a-1, min(b, len(lines))):
        print(f"{i+1}|{lines[i].rstrip()[:140]}")
