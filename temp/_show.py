from pathlib import Path
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
i = t.find(".v2-hero-copy")
print(t[i:i+1200])
