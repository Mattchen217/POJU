path = r"D:\POJU\pojulife\public\v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()
for i, l in enumerate(lines, 1):
    if 1820 <= i <= 1930:
        print(f"{i}|{l}", end="")
