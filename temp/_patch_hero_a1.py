# -*- coding: utf-8 -*-
"""Patch Hero A1' copy in public/v2-landing.html — EN/ZH hero slots only."""
from pathlib import Path

path = Path("public/v2-landing.html")
text = path.read_text(encoding="utf-8")
orig = text

# --- 1) HTML defaults (zh-looking static fallback → A1' EN defaults in markup;
#     JS HERO_COPY still drives locale. Use EN as HTML SSR default for clarity,
#     matching prior EN title in h1.) ---

old_trust = '<span id="v2-hero-trust">去中心化隐私保护 · 无云存储数据 · 本地加密保存</span>'
new_trust = '<span id="v2-hero-trust">That decision won\'t leave you alone.</span>'
assert old_trust in text, "trust span not found"
text = text.replace(old_trust, new_trust, 1)

old_h1 = (
    '<span class="gold-gradient">Eastern OS</span> — A personal decision operating system powered by '
    '<span class="gold-gradient">3,000 years</span> of Eastern wisdom.'
)
new_h1 = '<span class="gold-gradient">Eastern OS</span> — unstick it. Walk out with a path.'
assert old_h1 in text, "HTML h1 not found"
text = text.replace(old_h1, new_h1, 1)

old_sub = (
    "Combining your native energy architecture with the environmental energy matrix "
    "to deliver highly confidential, data-driven business and life decision support."
)
new_sub = (
    "A multi-turn decision dialogue: talk it through, leave with a main path and a backup, "
    "a report you'll use, plus optional 30-day same-line reminders. You keep the final call."
)
assert old_sub in text, "HTML subtitle not found"
text = text.replace(old_sub, new_sub, 1)

old_cta_start_html = '<span data-hero-cta="start">马上开始</span>'
new_cta_start_html = '<span data-hero-cta="start">Start now</span>'
assert old_cta_start_html in text, "start CTA html not found"
text = text.replace(old_cta_start_html, new_cta_start_html, 1)

old_cta_desk_html = '<span data-hero-cta="desktop">安装到桌面，获得原生 App 级体验</span>'
new_cta_desk_html = '<span data-hero-cta="desktop">What\'s in one PASS</span>'
assert old_cta_desk_html in text, "desktop CTA html not found"
text = text.replace(old_cta_desk_html, new_cta_desk_html, 1)

# --- 2) HERO_COPY en block ---
old_en = """              en: {
                title:
                  '<span class="gold-gradient">Eastern OS</span> — A personal decision operating system powered by <span class="gold-gradient">3,000 years</span> of Eastern wisdom.',
                subtitle:
                  'Combining your native energy architecture with the environmental energy matrix to deliver highly confidential, data-driven business and life decision support.',
                ctaStart: 'Get started',
                ctaDesktop: 'Install to desktop for a native App-level experience',
                ctaByOs: {
                  windows: '⚡ One-tap install · Windows desktop',
                  android: '⚡ One-tap install · App',
                  ios: '📲 Add to iPhone Home Screen',
                  mac: '💻 Add to Mac Dock',
                  other: 'Install to desktop for a native App-level experience',
                },"""

new_en = """              en: {
                eyebrow: 'That decision won\\'t leave you alone.',
                title:
                  '<span class="gold-gradient">Eastern OS</span> — unstick it. Walk out with a path.',
                subtitle:
                  'A multi-turn decision dialogue: talk it through, leave with a main path and a backup, a report you\\'ll use, plus optional 30-day same-line reminders. You keep the final call.',
                ctaStart: 'Start now',
                ctaDesktop: 'What\\'s in one PASS',
                ctaSecondary: 'What\\'s in one PASS',
                ctaByOs: {
                  windows: 'What\\'s in one PASS',
                  android: 'What\\'s in one PASS',
                  ios: 'What\\'s in one PASS',
                  mac: 'What\\'s in one PASS',
                  other: 'What\\'s in one PASS',
                },"""

assert old_en in text, "EN HERO_COPY block not found"
text = text.replace(old_en, new_en, 1)

# --- 3) HERO_COPY zh block ---
old_zh = """              zh: {
                title:
                  '<span class="gold-gradient">Eastern OS</span> — 沉淀 <span class="gold-gradient">3,000 年</span>东方智慧的个人决策操作系统。',
                subtitle:
                  '结合个人原生能量架构与环境场能矩阵，为你提供高保密、数据化的商业与人生决策支持。',
                ctaStart: '马上开始',
                ctaDesktop: '安装到桌面，获得原生 App 级体验',
                ctaByOs: {
                  windows: '⚡ 一键安装 Windows 桌面版',
                  android: '⚡ 一键安装 App',
                  ios: '📲 添加到 iPhone 主屏幕',
                  mac: '💻 添加到 Mac Dock 栏',
                  other: '安装到桌面，获得原生 App 级体验',
                },"""

new_zh = """              zh: {
                eyebrow: '那个决定，一直在脑子里转。',
                title:
                  '<span class="gold-gradient">Eastern OS</span> —— 破开卡住的决定，带走能走的路。',
                subtitle:
                  '多轮决策对话：把事谈清楚 → 主路径与一条备用 → 决策报告，可选 30 天同线提醒。最终决定仍在你。',
                ctaStart: '马上开始',
                ctaDesktop: '一次 PASS 有什么',
                ctaSecondary: '一次 PASS 有什么',
                ctaByOs: {
                  windows: '一次 PASS 有什么',
                  android: '一次 PASS 有什么',
                  ios: '一次 PASS 有什么',
                  mac: '一次 PASS 有什么',
                  other: '一次 PASS 有什么',
                },"""

assert old_zh in text, "ZH HERO_COPY block not found"
text = text.replace(old_zh, new_zh, 1)

# --- 4) Apply eyebrow when applying hero title/subtitle ---
old_apply = """            const hero = HERO_COPY[currentLocale] || HERO_COPY.en;
            const titleEl = document.getElementById('v2-hero-title');
            const subtitleEl = document.getElementById('v2-hero-subtitle');
            if (titleEl) titleEl.innerHTML = hero.title;
            if (subtitleEl) subtitleEl.textContent = hero.subtitle;"""

new_apply = """            const hero = HERO_COPY[currentLocale] || HERO_COPY.en;
            const titleEl = document.getElementById('v2-hero-title');
            const subtitleEl = document.getElementById('v2-hero-subtitle');
            const trustEl = document.getElementById('v2-hero-trust');
            if (titleEl) titleEl.innerHTML = hero.title;
            if (subtitleEl) subtitleEl.textContent = hero.subtitle;
            if (trustEl && hero.eyebrow) trustEl.textContent = hero.eyebrow;"""

assert old_apply in text, "hero apply block not found"
text = text.replace(old_apply, new_apply, 1)

# --- 5) syncHeroCtas: secondary = PASS copy (not OS install labels) ---
old_sync = """            function syncHeroCtas() {
              const pack = HERO_COPY[currentLocale] || HERO_COPY.en;
              const startEl = document.querySelector('[data-hero-cta="start"]');
              const deskEl = document.querySelector('[data-hero-cta="desktop"]');
              const deskBtn = document.getElementById('v2-hero-cta-desktop');
              if (startEl && pack.ctaStart) startEl.textContent = pack.ctaStart;
              if (isStandalonePwa()) {
                if (deskBtn) deskBtn.hidden = true;
                return;
              }
              if (deskBtn) deskBtn.hidden = false;
              const os = detectOS();
              const byOs = (pack.ctaByOs && pack.ctaByOs[os]) || pack.ctaDesktop;
              if (deskEl && byOs) deskEl.textContent = byOs;
            }"""

new_sync = """            function syncHeroCtas() {
              const pack = HERO_COPY[currentLocale] || HERO_COPY.en;
              const startEl = document.querySelector('[data-hero-cta="start"]');
              const deskEl = document.querySelector('[data-hero-cta="desktop"]');
              const deskBtn = document.getElementById('v2-hero-cta-desktop');
              if (startEl && pack.ctaStart) startEl.textContent = pack.ctaStart;
              // Secondary CTA is PASS overview (not Windows/desktop install).
              if (deskBtn) deskBtn.hidden = false;
              const secondary = pack.ctaSecondary || pack.ctaDesktop;
              if (deskEl && secondary) deskEl.textContent = secondary;
            }"""

assert old_sync in text, "syncHeroCtas not found"
text = text.replace(old_sync, new_sync, 1)

# --- 6) Secondary click → scroll to PASS pricing (keep install modal for other entry points) ---
old_click = """            syncHeroCtas();
            const desktopCta = document.getElementById('v2-hero-cta-desktop');
            if (desktopCta) {
              desktopCta.addEventListener('click', function () {
                void handleInstallClick();
              });
            }"""

new_click = """            syncHeroCtas();
            const desktopCta = document.getElementById('v2-hero-cta-desktop');
            if (desktopCta) {
              desktopCta.addEventListener('click', function () {
                const passSec = document.getElementById('v2-pricing');
                if (passSec && typeof passSec.scrollIntoView === 'function') {
                  passSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                  location.hash = '#v2-pricing';
                }
              });
            }"""

assert old_click in text, "desktop click handler not found"
text = text.replace(old_click, new_click, 1)

assert text != orig, "no changes made"
path.write_text(text, encoding="utf-8", newline="\n")
print("OK patched", path)
print("bytes", len(text.encode("utf-8")))
