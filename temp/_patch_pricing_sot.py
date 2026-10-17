# -*- coding: utf-8 -*-
import re, json, pathlib

path = pathlib.Path(r"D:\POJU\pojulife\public\v2-landing.html")
html = path.read_text(encoding="utf-8")
orig = html

# --- 1) PASS_UNIT display constant ---
html2, n = re.subn(r"const PASS_UNIT = 9\.99;", "const PASS_UNIT = 19.99;", html, count=1)
assert n == 1, f"PASS_UNIT replace failed: {n}"
html = html2

# --- 2) Default CTA price in HTML ---
html2, n = re.subn(
    r'(id="v2-pass-buy-price">)\$9\.99',
    r"\g<1>$19.99",
    html,
    count=1,
)
assert n == 1, f"buy-price default replace failed: {n}"
html = html2

# --- 3) Grid 3 -> 2 ---
html2, n = re.subn(
    r'grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch" id="v2-price-grid"',
    'grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch" id="v2-price-grid"',
    html,
    count=1,
)
assert n == 1, f"grid replace failed: {n}"
html = html2

# --- 4) Remove family/team card article ---
fam_pat = re.compile(
    r'\s*<article class="[^"]*" id="v2-price-family" data-plan="family">.*?</article>',
    re.DOTALL,
)
html2, n = fam_pat.subn("", html, count=1)
assert n == 1, f"family card remove failed: {n}"
html = html2

# --- 5) Card2 CTA title -> ctaTitle ---
html2, n = re.subn(
    r'(data-plan-intent="personal_plan">\s*<span class="v2-price-cta__title" data-pricing-c=")card2\.title(">)',
    r"\1card2.ctaTitle\2",
    html,
    count=1,
)
assert n == 1, f"ctaTitle attr replace failed: {n}"
html = html2

# --- 6) Replace PRICING_I18N object ---
new_i18n = {
  "zh": {
    "header": {
      "title": "透明定价，随心选择",
      "subtitle": "<strong>1 Pass</strong> = 一次完整 Eastern OS：对话 → 主/备+报告 → 30 天同线提醒<strong>同步提供</strong>。可按次购买，也可包月订阅。"
    },
    "card1": {
      "badge": "零绑定 · 按需购买",
      "title": "购买 Pass",
      "price": "$19.99",
      "unit": "/ Pass",
      "features": [
        "<strong>1 Pass</strong> = 一次完整：对话 → 主/备+报告 → 30 天同线提醒<strong>同步提供</strong>",
        "一次性，不自动续费",
        "额度随买随用，永久有效，用完为止",
        "支持一键退款"
      ],
      "cta": "购买 Pass $19.99",
      "qty": "{n} Pass",
      "cta_tpl": "购买 {n} Pass (${total})"
    },
    "card2": {
      "badge": "最受欢迎 · 单 Pass 低至 ≈ $12（6 折）",
      "title": "订阅包",
      "ctaTitle": "订阅包",
      "price": "$59.99",
      "unit": "/ 月",
      "passCount": "5 Passes / 月",
      "features": [
        "<strong>1 Pass</strong> = 一次完整：对话 → 主/备+报告 → 30 天同线提醒<strong>同步提供</strong>",
        "每月发放 5 PASS",
        "新用户首月送 2 PASS（该月单 Pass 低至 ≈ $8.57）",
        "按计费月刷新",
        "订阅额度优先消耗",
        "支持一键取消订阅"
      ],
      "cta": "订阅包 $59.99"
    },
    "card3": {
      "badge": "",
      "title": "",
      "price": "",
      "unit": "",
      "passCount": "",
      "features": [],
      "cta": ""
    },
    "upsell": {
      "u3_title": "为你发现更合适的方案",
      "u3_body": "你当前选择了 {n} 张 Pass（总计 ${total}）。推荐升级为订阅包：只需 $59.99 /月，每月 5 PASS，新用户首月再送 2 PASS。",
      "u3_upgrade": "升级为订阅包",
      "u3_keep": "仍购买 {n} 张 Pass (${total})",
      "u6_title": "批量购买？订阅更划算",
      "u6_body": "你当前选择了 {n} 张 Pass（总计 ${total}）。订阅包 $59.99 /月，每月 5 PASS，单 Pass 低至 ≈ $12。",
      "u6_upgrade": "查看订阅包",
      "u6_keep": "仍购买 {n} 张 Pass (${total})"
    }
  },
  "en": {
    "header": {
      "title": "Clear pricing. Your call.",
      "subtitle": "<strong>1 Pass</strong> = one full Eastern OS run: dialogue → main path + backup + report → 30-day same-line reminders <strong>provided together</strong>. Buy once—or subscribe monthly."
    },
    "card1": {
      "badge": "No lock-in · pay as you go",
      "title": "Buy Pass",
      "price": "$19.99",
      "unit": "/ Pass",
      "features": [
        "<strong>1 Pass</strong> = one full run: dialogue → main path + backup + report → 30-day same-line reminders <strong>provided together</strong>.",
        "One-time. No auto-renew.",
        "Use anytime—valid until used.",
        "One-click refund."
      ],
      "cta": "Buy Pass $19.99",
      "qty": "{n} Pass|{n} Passes",
      "cta_tpl": "Buy {n} Pass (${total})|Buy {n} Passes (${total})"
    },
    "card2": {
      "badge": "Most popular · as low as ≈ $12 / Pass (~40% off)",
      "title": "Subscription",
      "ctaTitle": "Subscribe",
      "price": "$59.99",
      "unit": "/ mo",
      "passCount": "5 Passes / month",
      "features": [
        "<strong>1 Pass</strong> = one full run: dialogue → main path + backup + report → 30-day same-line reminders <strong>provided together</strong>.",
        "5 PASS granted every month.",
        "New subscribers—first month only: +2 bonus (≈ $8.57 / Pass that month).",
        "Refreshes each billing month.",
        "Subscription credits use first.",
        "Cancel anytime—one click."
      ],
      "cta": "Subscribe $59.99"
    },
    "card3": {
      "badge": "",
      "title": "",
      "price": "",
      "unit": "",
      "passCount": "",
      "features": [],
      "cta": ""
    },
    "upsell": {
      "u3_title": "A clearer value option",
      "u3_body": "You selected {n} Passes (${total}). Subscription is $59.99 / month with 5 PASS each month—new subscribers get +2 bonus the first month.",
      "u3_upgrade": "Upgrade to Subscription",
      "u3_keep": "Keep {n} Passes (${total})",
      "u6_title": "Buying in bulk? Subscribe instead",
      "u6_body": "You selected {n} Passes (${total}). Subscription is $59.99 / month with 5 PASS—as low as ≈ $12 / Pass.",
      "u6_upgrade": "See Subscription",
      "u6_keep": "Keep {n} Passes (${total})"
    }
  }
}

m = re.search(r"const PRICING_I18N = \{", html)
assert m, "PRICING_I18N start not found"
start = m.start()
i = m.end() - 1
depth = 0
end = None
for j in range(i, len(html)):
    ch = html[j]
    if ch == "{":
        depth += 1
    elif ch == "}":
        depth -= 1
        if depth == 0:
            end = j + 1
            break
assert end, "PRICING_I18N end not found"
while end < len(html) and html[end] in " \t":
    end += 1
if end < len(html) and html[end] == ";":
    end += 1

i18n_js = "const PRICING_I18N = " + json.dumps(new_i18n, ensure_ascii=False, indent=2) + ";"
html = html[:start] + i18n_js + html[end:]

# --- 7) allowStrong + header innerHTML ---
old_render_snip = "'<span class=\"v2-price-feature__text\">' + escapeHtml(parts.main) + '</span>'"
new_render_snip = "'<span class=\"v2-price-feature__text\">' + allowStrong(parts.main) + '</span>'"
if old_render_snip not in html:
    raise SystemExit("renderFeatureItem snip not found")
html = html.replace(old_render_snip, new_render_snip, 1)

escape_fn = """function escapeHtml(s) {
                return String(s)
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/\"/g, '&quot;');
              }"""
allow_fn = """function escapeHtml(s) {
                return String(s)
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/\"/g, '&quot;');
              }
              function allowStrong(s) {
                return escapeHtml(s)
                  .replace(/&lt;strong&gt;/g, '<strong>')
                  .replace(/&lt;\\/strong&gt;/g, '</strong>');
              }"""
if escape_fn not in html:
    raise SystemExit("escapeHtml block not found")
html = html.replace(escape_fn, allow_fn, 1)

old_h = "if (key && pack.header && pack.header[key] != null) el.textContent = pack.header[key];"
new_h = "if (key && pack.header && pack.header[key] != null) el.innerHTML = pack.header[key];"
if old_h not in html:
    raise SystemExit("header textContent line not found")
html = html.replace(old_h, new_h, 1)

# Sanity
assert 'md:grid-cols-2' in html
assert 'id="v2-price-family"' not in html
assert "const PASS_UNIT = 19.99;" in html
i18n_start = html.find("const PRICING_I18N")
i18n_end = html.find("function pricingPack")
block = html[i18n_start:i18n_end]
assert "Atmos / Pivot" not in block, "engine list still in PRICING_I18N"
assert "$9.99" not in block, "old $9.99 still in PRICING_I18N"
assert "$29.90" not in block, "old $29.90 still in PRICING_I18N"
assert "$59.90" not in block, "old $59.90 still in PRICING_I18N"
assert "15 Pass" not in block, "15 Pass still in PRICING_I18N"
assert "Clear pricing. Your call." in block
assert "透明定价，随心选择" in block
assert "card2.ctaTitle" in html
assert 'id="v2-price-flex"' in html
assert 'id="v2-price-personal"' in html
# How+Get / Privacy untouched markers
assert "eos-landing-how-get" in html or "HOW_GET_COPY" in html
assert "PRIVACY_COPY" in html

path.write_text(html, encoding="utf-8")
print("OK patched", path)
print("size", len(orig), "->", len(html), "delta", len(html) - len(orig))
