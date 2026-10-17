# -*- coding: utf-8 -*-
from pathlib import Path
import subprocess, re

path = Path(r"D:\POJU\pojulife\public\v2-landing.html")
text = path.read_text(encoding="utf-8")

# Extract engines section from working tree vs HEAD
def extract(tag_id, html):
    m = re.search(rf'<section id="{tag_id}"[\s\S]*?</section>', html)
    return m.group(0) if m else None

head = subprocess.check_output(
    ["git", "show", "HEAD:public/v2-landing.html"],
    cwd=r"D:\POJU\pojulife",
).decode("utf-8")

eng_old = extract("v2-engines", head)
eng_new = extract("v2-engines", text)
print("engines identical:", eng_old == eng_new)
print("engines old len", len(eng_old or ""), "new", len(eng_new or ""))

# Verify no 1 PASS in eos-landing-scenarios
scen = extract("eos-landing-scenarios", text)
print("1 PASS in scenarios section:", "1 PASS" in (scen or ""))
print("PASSX1 still in engines:", "PASSX1" in (eng_new or ""))

# Dump header + cards summary
for key in ["forks", "crossroads", "career", "relationship", "timing"]:
    m = re.search(rf'data-eos-scenario="{key}"[\s\S]*?data-eos-scenario-tagline>(.*?)</p>[\s\S]*?data-eos-scenario-desc>(.*?)</p>', scen)
    if m:
        tag, desc = m.group(1), m.group(2)
        print(f"\n[{key}] TAG: {tag[:80]}")
        print(f"[{key}] DESC[:120]: {desc[:120]}")

# Header block
hm = re.search(r'id="eos-scenarios-h1"[^>]*>(.*?)</h2>', text)
print("\nH1:", hm.group(1) if hm else None)
s1 = re.search(r'id="eos-scenarios-sub-l1"[^>]*>(.*?)</p>', text)
s2 = re.search(r'id="eos-scenarios-sub-l2"[^>]*>(.*?)</p>', text)
print("L1:", s1.group(1) if s1 else None)
print("L2:", s2.group(1) if s2 else None)

# ZH samples in EOS_SCENARIOS_COPY
assert "为真正要紧的决定而建" in text
assert "一场聚焦对话，多层深度推理" in text
assert "拖下去，成本已经在涨。" in text
assert "几条路都像对，没有一条踏实。" in text
assert "今晚得有个说法" in text
assert "卡住的是你" in text
assert "泛泛「时机好」没用" in text
assert "人生分叉不会越拖越清楚" in text

# strip header hidden
assert 'id="v2-scenarios-header" class="sr-only"' in text
print("\nstrip header is sr-only: OK")
print("VERIFY OK")
