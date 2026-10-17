from pathlib import Path
text = Path("temp/_head_landing.html").read_text(encoding="utf-8-sig")
lines = text.splitlines()
for i,l in enumerate(lines):
    if "<style" in l or "</style>" in l or 'id="eos-landing-v2-top"' in l or 'id="v2-hero"' in l or "<body" in l:
        print(f"{i+1}: {l.strip()[:110]}")
print("total", len(lines), len(text))
print("style opens", text.count("<style"), "closes", text.count("</style>"))
# any section/main tags before </style>?
style_end = text.find("</style>")
before = text[:style_end]
print("section before style end", before.count("<section"))
print("main before style end", before.count("<main"))
print("id=v2-hero before style end", 'id="v2-hero"' in before)
