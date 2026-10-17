path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()
# print locale apply region ~3275-3350
for i in range(3270, 3345):
    print(f"{i+1}:{lines[i].rstrip()}")
