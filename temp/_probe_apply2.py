path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
idx = text.find("document.querySelectorAll('[data-built]')")
print(text[idx:idx+500])
