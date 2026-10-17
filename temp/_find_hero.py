import sys
sys.stdout.reconfigure(encoding="utf-8")
with open("public/v2-landing.html", "r", encoding="utf-8") as f:
    lines = f.readlines()
keys = ["data-hero", "hero-eyebrow", "v2-hero", "ctaStart", "ctaDesktop", "hero.title", "pack.cta", "EOS_LANDING", "eyebrow", "unstick", "破开", "那个决定", "Start now", "马上开始", "PASS", "Get started"]
for i, line in enumerate(lines):
    for k in keys:
        if k.lower() in line.lower() or k in line:
            print(f"{i+1}|{line.rstrip()[:240]}")
            break
