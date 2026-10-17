from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
m = re.search(r"const HERO_COPY = \{([\s\S]*?)\n            \};", t)
block = m.group(1)
# pull eyebrow/title/subtitle for en and zh via simpler find
for loc in ("en", "zh"):
    i = block.find(f"{loc}: {{")
    chunk = block[i:i+700]
    Path(f"temp/_hero_v41_{loc}2.txt").write_text(chunk, encoding="utf-8")
    print(loc, "Stuck" in chunk or "卡住" in chunk, "Eastern OS" in chunk, "v2-hero-title-l2" in chunk)
print("en eyebrow present", "Stuck on a decision that won't let go?" in t)
print("zh eyebrow present", "你被什么决定卡住了吗？" in t)
print("zh L1", "帮你破开卡住的那一步" in t)
print("zh L2", "带走主路径，和一条你真能过的备用" in t)
print("zh sub", "不是再多一堆意见" in t)
print("en sub", "Not another pile of opinions" in t)
print("cta still", 'href="/app?tab=atmos"' in t and "Start now" in t)
