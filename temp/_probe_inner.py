path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
# find hero i18n apply patterns
idx = 0
while True:
    i = text.find("innerHTML", idx)
    if i < 0: break
    ctx = text[max(0,i-80):i+80]
    if "built" in ctx or "hero" in ctx.lower() or "pack" in ctx or "gold" in ctx:
        print(ctx.replace("\n"," "))
        print("---")
    idx = i + 1
    if idx > 200000 and i > 170000:
        pass
# count relevant
print("total innerHTML", text.count("innerHTML"))
