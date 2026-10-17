# -*- coding: utf-8 -*-
import sys, re
sys.stdout.reconfigure(encoding="utf-8")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Find how locale is applied - search patterns
for needle in ["function apply", "locale ===", "currentLocale", "setLocale", "data-i18n", "BUILT_COPY", "SCENARIOS_COPY", "HERO_COPY", "langPack", "LOCALE_PACKS"]:
    positions = [m.start() for m in re.finditer(re.escape(needle), text)]
    print(f"{needle}: {positions[:8]} count={len(positions)}")

# Find v2-hero-cta-primary and Start now href
idx = text.find("v2-hero-cta-start")
print("\n=== hero CTA ===")
print(text[idx-100:idx+250])

# Find scenarios i18n apply pattern
idx = text.find("SCENARIOS_COPY")
print("\n=== SCENARIOS_COPY start ===")
print(text[idx:idx+500])
# find apply function for scenarios
for m in re.finditer(r"SCENARIOS_COPY|applyScenarios|eos-scenarios-h1|function\s+\w*[Ll]ocale", text):
    if m.start() > 140000:
        print(m.group(), "at", m.start())
        if m.start() > 160000:
            break
