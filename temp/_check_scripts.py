from pathlib import Path
text = Path("temp/_head_landing.html").read_text(encoding="utf-8-sig")
lines = text.splitlines()
for i in range(15, 70):
    print(f"{i+1}: {lines[i][:120]}")
print("--- first constellation ---")
print(text.find("v2-hero-constellation"))
print("--- scripts before that ---")
pos = text.find("v2-hero-constellation")
idx = 0
while True:
    s = text.find("<script", idx)
    if s < 0 or s > pos:
        break
    print("script at", s, "line", text[:s].count(chr(10))+1, text[s:s+80].replace(chr(10),' '))
    idx = s+1
