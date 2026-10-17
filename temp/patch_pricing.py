# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys

path = Path(r"D:\POJU\pojulife\public\v2-landing.html")
text = path.read_text(encoding="utf-8")
original = text

pi = text.find("const PRICING_I18N")
print("PRICING_I18N at", pi)

# --- inspect ---
m = re.search(r'"zh"\s*:\s*\{\s*"header"\s*:\s*\{\s*"title"\s*:\s*"(.*?)"', text[pi:pi+600], re.S)
zh_title = m.group(1) if m else None
print("ZH title repr:", repr(zh_title))
if zh_title:
    print("ZH codepoints:", [hex(ord(c)) for c in zh_title])

men = re.search(r'"en"\s*:\s*\{\s*"header"\s*:\s*\{\s*"title"\s*:\s*"([^"]*)"', text[pi:])
en_title = men.group(1) if men else None
print("EN title repr:", repr(en_title))

idx = text.find("function isBonusFeature")
print("isBonusFeature snippet:", repr(text[idx:idx+250]))

micon = re.search(
    r'(id="v2-price-personal"[^>]*>[\s\S]*?material-symbols-outlined[^>]*>)([^<]+)(</span>)',
    text,
)
print("icon before:", repr(micon.group(2) if micon else None))

# needles
for needle in ["透明", "定价", "随心选择", "首月", "新用户首月", "加送", "限时"]:
    print("find", repr(needle), "->", text.find(needle))

# --- edits ---
changes = []

# 1) ZH title: wrap 定价 in gold-gradient
# Current expected: 透明定价，随心选择  (may already have gold or be mojibake)
zh_target = '透明<span class="gold-gradient">定价</span>，随心选择'
zh_plain = "透明定价，随心选择"
zh_already = 'gold-gradient">定价'

# Replace within PRICING_I18N zh header title only
zh_header_pat = re.compile(
    r'("zh"\s*:\s*\{\s*"header"\s*:\s*\{\s*"title"\s*:\s*")(.*?)(")',
    re.S,
)

def zh_header_repl(m):
    old = m.group(2)
    # If already has gold span on 定价, keep
    if 'gold-gradient">定价' in old or "gold-gradient\\\">定价" in old:
        return m.group(0)
    # If plain title
    if old == zh_plain or ("透明" in old and "定价" in old and "随心" in old and "gold-gradient" not in old):
        # rebuild as target; if mojibake, still try replace 定价 substring
        if old == zh_plain:
            new = zh_target
        else:
            # wrap 定价 if present
            new = old.replace("定价", '<span class="gold-gradient">定价</span>', 1)
        changes.append(("ZH title", old, new))
        return m.group(1) + new + m.group(3)
    # mojibake fallback: if looks like garbled version of same length pattern
    # Try to detect common GBK-misread of 透明定价，随心选择
    # Expected UTF-8 for 透明定价，随心选择:
    expected = "透明定价，随心选择"
    if old == expected:
        new = zh_target
        changes.append(("ZH title", old, new))
        return m.group(1) + new + m.group(3)
    print("WARN: unexpected ZH title, will force set to target. was:", repr(old))
    changes.append(("ZH title FORCE", old, zh_target))
    return m.group(1) + zh_target + m.group(3)

text2, nzh = zh_header_pat.subn(zh_header_repl, text, count=1)
if nzh != 1:
    print("ERROR: zh header title replace count", nzh)
    sys.exit(1)
text = text2

# 2) EN title
en_plain = "Clear pricing. Your call."
en_target = 'Clear <span class="gold-gradient">pricing</span>. Your call.'
en_header_pat = re.compile(
    r'("en"\s*:\s*\{\s*"header"\s*:\s*\{\s*"title"\s*:\s*")(.*?)(")',
    re.S,
)

def en_header_repl(m):
    old = m.group(2)
    if 'gold-gradient">pricing' in old:
        return m.group(0)
    if old == en_plain or (old.startswith("Clear") and "pricing" in old and "gold-gradient" not in old):
        new = en_target if old == en_plain else old.replace("pricing", '<span class="gold-gradient">pricing</span>', 1)
        # only wrap the word pricing once carefully
        if old == en_plain:
            new = en_target
        changes.append(("EN title", old, new))
        return m.group(1) + new + m.group(3)
    print("WARN unexpected EN", repr(old))
    changes.append(("EN title FORCE", old, en_target))
    return m.group(1) + en_target + m.group(3)

# Only replace the first en header inside PRICING_I18N — search from pi
before = text[:pi]
after = text[pi:]
after2, nen = en_header_pat.subn(en_header_repl, after, count=1)
if nen != 1:
    print("ERROR: en header title replace count", nen)
    sys.exit(1)
text = before + after2

# 3) isBonusFeature regex — extend patterns
# Current approx: /限时|加送|bonus|Bono|Bonus|Limited-time|Zeitlich|durée limitée|限时加送/i
bonus_pat = re.compile(
    r'(function isBonusFeature\(text\) \{\s*return )(/[^/\n]+/i)(\.test\(String\(text \|\| \'\'\)\);\s*\})'
)
mb = bonus_pat.search(text)
if not mb:
    # try alternate quote styles
    bonus_pat2 = re.compile(
        r'(function isBonusFeature\(text\) \{\s*return )(/[^/\n]+/i)(\.test\(String\(text \|\| ""\)\);\s*\})'
    )
    mb = bonus_pat2.search(text)
    bonus_pat = bonus_pat2

if not mb:
    print("ERROR: could not find isBonusFeature regex")
    idx = text.find("function isBonusFeature")
    print(repr(text[idx:idx+300]))
    sys.exit(1)

old_re = mb.group(2)
print("old bonus regex:", old_re)
# Build new regex: keep existing body, add 首月|新用户首月|\+2|first month if missing
inner = old_re[1:-2]  # strip / and /i
additions = ["首月", "新用户首月", r"\+2", "first month"]
for a in additions:
    # check if already present (unescaped form for +2)
    check = a.replace(r"\+2", "+2")
    if check.lower() in inner.lower() or a in inner:
        continue
    inner = inner + "|" + a
new_re = "/" + inner + "/i"
if new_re != old_re:
    text = text[: mb.start(2)] + new_re + text[mb.end(2) :]
    changes.append(("isBonusFeature", old_re, new_re))
else:
    changes.append(("isBonusFeature", old_re, "unchanged"))

# 4) icon person -> subscriptions in #v2-price-personal only
def icon_repl(m):
    old = m.group(2)
    if old.strip() == "subscriptions":
        return m.group(0)
    changes.append(("icon", old.strip(), "subscriptions"))
    return m.group(1) + "subscriptions" + m.group(3)

text3, nicon = re.subn(
    r'(id="v2-price-personal"[^>]*>[\s\S]*?material-symbols-outlined[^>]*>)([^<]+)(</span>)',
    icon_repl,
    text,
    count=1,
)
if nicon != 1:
    print("ERROR: icon replace count", nicon)
    sys.exit(1)
text = text3

if text == original:
    print("WARNING: no net change to file")
else:
    path.write_text(text, encoding="utf-8", newline="\n")
    # preserve newlines? check original newline style
    # re-read was fine; Windows may want \n as file had

print("=== CHANGES ===")
for c in changes:
    print(c[0], ":", repr(c[1]), "->", repr(c[2]))

# --- verify ---
text = path.read_text(encoding="utf-8")
checks = {
    'ZH gold 定价': 'gold-gradient">定价' in text,
    'EN gold pricing': 'gold-gradient">pricing' in text,
    'icon subscriptions': bool(re.search(
        r'id="v2-price-personal"[^>]*>[\s\S]*?material-symbols-outlined[^>]*>subscriptions</span>',
        text,
    )),
    'icon not person in personal': not bool(re.search(
        r'id="v2-price-personal"[^>]*>[\s\S]*?material-symbols-outlined[^>]*>person</span>',
        text,
    )),
    'applyPricingCopy innerHTML': "el.innerHTML = pack.header[key]" in text or "el.innerHTML = pack.header" in text,
}
# isBonusFeature test
mb2 = re.search(r'function isBonusFeature\(text\) \{\s*return (/.*?/);', text)
bonus_src = mb2.group(1) if mb2 else None
print("new bonus regex:", bonus_src)

# Evaluate the regex in Python by extracting pattern
if bonus_src:
    body = bonus_src[1:-2]  # /.../i
    flags = re.I
    cre = re.compile(body, flags)
    samples = [
        "新用户首月送 2 PASS（当月每 Pass 低至 ≈ $8.57）",
        "New subscribers—first month only: +2 bonus (≈ $8.57 / Pass that month).",
        "+2 bonus",
        "first month",
        "普通功能",
        "5 PASS granted every month.",
    ]
    # Also try actual card2 feature strings from file
    pi = text.find("const PRICING_I18N")
    # zh card2 features
    mzhc = re.search(
        r'"zh"\s*:[\s\S]*?"card2"\s*:[\s\S]*?"features"\s*:\s*\[([\s\S]*?)\]',
        text[pi : pi + 4000],
    )
    if mzhc:
        feats = re.findall(r'"((?:\\.|[^"\\])*)"', mzhc.group(1))
        print("ZH card2 features:")
        for i, f in enumerate(feats):
            print(i, repr(f), "bonus=", bool(cre.search(f)))
    menc = re.search(
        r'"en"\s*:[\s\S]*?"card2"\s*:[\s\S]*?"features"\s*:\s*\[([\s\S]*?)\]',
        text[pi : pi + 8000],
    )
    if menc:
        feats = re.findall(r'"((?:\\.|[^"\\])*)"', menc.group(1))
        print("EN card2 features:")
        for i, f in enumerate(feats):
            print(i, repr(f), "bonus=", bool(cre.search(f)))

    for s in samples:
        print("sample", repr(s), "->", bool(cre.search(s)))

print("=== CHECKS ===")
for k, v in checks.items():
    print(k, ":", v)

# titles after
m = re.search(r'"zh"\s*:\s*\{\s*"header"\s*:\s*\{\s*"title"\s*:\s*"(.*?)"', text[text.find("const PRICING_I18N"):text.find("const PRICING_I18N")+800], re.S)
print("final ZH title:", m.group(1) if m else None)
men = re.search(r'"en"\s*:\s*\{\s*"header"\s*:\s*\{\s*"title"\s*:\s*"([^"]*)"', text[text.find("const PRICING_I18N"):])
print("final EN title:", men.group(1) if men else None)

print("OK" if all(checks.values()) else "FAIL")
