path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()
for i in range(4490, 4560):
    print(f"{i+1}:{lines[i].rstrip()}")
