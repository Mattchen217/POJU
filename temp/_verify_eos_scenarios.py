# -*- coding: utf-8 -*-
from pathlib import Path
import re
text = Path("public/v2-landing.html").read_text(encoding="utf-8")

# order of sections
for sid in ["v2-scenarios", "v2-product-preview", "eos-landing-scenarios", "v2-engines", "eos-landing-v2-top"]:
    print(sid, "pos", text.find(f'id="{sid}"'))

m = re.search(r'<section id="eos-landing-scenarios".*?</section>', text, re.S)
assert m, "section missing"
sec = m.group(0)
print("section len", len(sec))
print("cards", sec.count('data-eos-scenario='))
print("cta hrefs", set(re.findall(r'href="([^"]+)"', sec)))
print("PASSX1 in section", "PASSX1" in sec or "PASS X1" in sec or "PASSX" in sec)
print("engine names in titles?", any(x in sec for x in ["ATMOS", "PIVOT", "MATCH", "SYNCRO", "GLYPH"]))
print("进入 in section", "进入" in sec)
print("场能" in sec, "energy" in sec.lower() and "Energy" in sec)  # rough

# extract titles/descs/eyebrow from HTML defaults
print("eyebrow HTML:", re.search(r'id="eos-scenarios-eyebrow"[^>]*>([^<]+)', sec).group(1))
titles = re.findall(r'data-eos-scenario-title>([^<]+)', sec)
print("titles:", titles)
ctas = set(re.findall(r'data-eos-scenario-cta>([^<]+)', sec))
print("ctas:", ctas)

# JS copy checks
assert "EOS_SCENARIOS_COPY" in text
# exact ZH strings
zh_checks = [
    "专为高价值与高风险场景打造",
    "重大抉择",
    "事业破局",
    "关系契合",
    "时机与节奏",
    "人生分叉",
    "马上开始",
    "几条路都像对、又都不踏实时——先钉住「好」长什么样，再带走主路径和一条备用。",
    "offer、留或走、转型。把这一步压测到今晚能动手——不是再列一张空泛利弊表。",
    "伴侣、家人、团队把你往两边拉。把张力看清——决定仍在你，不外包。",
    "该推、该等、还是该盯。带走钉在本案上的短清单——不是泛泛「时机好」。",
    "人生分叉、拖下去成本在涨。一次聚焦：对话 → 决策报告 → 可选 30 天同线提醒。",
]
for s in zh_checks:
    print("ZH ok" if s in text else f"MISSING ZH: {s}")

en_checks = [
    "Built for high-stakes decisions",
    "Major crossroads",
    "Career breakthrough",
    "Relationship fit",
    "Timing & rhythm",
    "Life forks",
    "Start now",
    "When more than one path looks right—and none feels safe—lock what “good” means, then walk out with a main route and a backup.",
]
for s in en_checks:
    print("EN ok" if s in text else f"MISSING EN: {s}")

# old strip + carousel intact
assert 'id="v2-scenarios"' in text
assert 'id="v2-product-carousel"' in text
assert 'id="v2-engines"' in text
assert 'eos-landing-v2-top' not in text or text.find('id="eos-landing-v2-top"') < 0
print("no eos-landing-v2-top:", 'id="eos-landing-v2-top"' not in text)
print("hero cta still:", 'id="v2-hero-cta-start"' in text and 'href="/app?tab=atmos"' in text[text.find("v2-hero-cta-start")-80:text.find("v2-hero-cta-start")+20])
print("apply wiring:", "eos-scenarios-eyebrow" in text and "data-eos-scenario-title" in text)
