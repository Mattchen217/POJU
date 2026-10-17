# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"public/v2-landing.html")
text = path.read_text(encoding="utf-8")
orig = text

# 1) Insert nav Install button before language switcher
old_nav = '''<div class="flex items-center gap-3 sm:gap-4">
<div class="relative" id="v2-lang-switcher">'''

new_nav = '''<div class="flex items-center gap-3 sm:gap-4">
<button type="button" id="v2-nav-install" class="hidden min-h-[44px] items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-100 hover:text-primary transition-colors" aria-label="Install app" hidden>
<span class="material-icons-outlined text-base" aria-hidden="true">install_desktop</span>
<span data-nav-install-label>Install app</span>
</button>
<div class="relative" id="v2-lang-switcher">'''

if old_nav not in text:
    raise SystemExit("nav anchor not found")
text = text.replace(old_nav, new_nav, 1)

# 2) Remove secondary hero CTA button (keep primary only)
old_hero = '''<div class="v2-hero-ctas mt-10 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
<a href="/app?tab=atmos" target="_top" id="v2-hero-cta-start" class="v2-hero-cta-primary inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 font-bold shadow-xl shadow-primary/25">
<span data-hero-cta="start">Start now</span>
<span class="material-icons-outlined text-xl" aria-hidden="true">arrow_forward</span>
</a>
<button type="button" id="v2-hero-cta-desktop" class="v2-hero-cta-desktop inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 font-bold text-slate-100 transition-all hover:bg-white/10">
<span data-hero-cta="desktop">What's in one PASS</span>
</button>
</div>'''

new_hero = '''<div class="v2-hero-ctas mt-10 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
<a href="/app?tab=atmos" target="_top" id="v2-hero-cta-start" class="v2-hero-cta-primary inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 font-bold shadow-xl shadow-primary/25">
<span data-hero-cta="start">Start now</span>
<span class="material-icons-outlined text-xl" aria-hidden="true">arrow_forward</span>
</a>
</div>'''

if old_hero not in text:
    raise SystemExit("hero CTA block not found")
text = text.replace(old_hero, new_hero, 1)

# 3) Add navInstall labels to HERO_COPY locales (after ctaStart lines)
replacements = [
    (
        "                ctaStart: 'Start now',\n                ctaDesktop: 'What\\'s in one PASS',",
        "                ctaStart: 'Start now',\n                navInstall: 'Install app',\n                ctaDesktop: 'What\\'s in one PASS',",
    ),
    (
        "                ctaStart: '马上开始',\n                ctaDesktop: '一次 PASS 有什么',",
        "                ctaStart: '马上开始',\n                navInstall: '添加到桌面',\n                ctaDesktop: '一次 PASS 有什么',",
    ),
    (
        "                ctaStart: 'Empezar ahora',\n                ctaDesktop: 'Instálalo en el escritorio para una experiencia de App nativa',",
        "                ctaStart: 'Empezar ahora',\n                navInstall: 'Install app',\n                ctaDesktop: 'Instálalo en el escritorio para una experiencia de App nativa',",
    ),
    (
        "                ctaStart: 'Commencer',\n                ctaDesktop: 'Installer sur le bureau pour une expérience d’App native',",
        "                ctaStart: 'Commencer',\n                navInstall: 'Install app',\n                ctaDesktop: 'Installer sur le bureau pour une expérience d’App native',",
    ),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f"HERO_COPY ctaStart block not found:\n{old[:80]}")
    text = text.replace(old, new, 1)

# 4) Neutralize es/fr Windows-only secondary button labels (unused after hero secondary removal, keep platform-neutral)
text = text.replace(
    "windows: '⚡ Instalación en un toque · Windows'",
    "windows: 'Install app'",
    1,
)
text = text.replace(
    "windows: '⚡ Installation en un clic · Windows'",
    "windows: 'Install app'",
    1,
)

# 5) Replace syncHeroCtas + wiring
old_sync = '''            function syncHeroCtas() {
              const pack = HERO_COPY[currentLocale] || HERO_COPY.en;
              const startEl = document.querySelector('[data-hero-cta="start"]');
              const deskEl = document.querySelector('[data-hero-cta="desktop"]');
              const deskBtn = document.getElementById('v2-hero-cta-desktop');
              if (startEl && pack.ctaStart) startEl.textContent = pack.ctaStart;
              // Secondary CTA is PASS overview (not Windows/desktop install).
              if (deskBtn) deskBtn.hidden = false;
              const secondary = pack.ctaSecondary || pack.ctaDesktop;
              if (deskEl && secondary) deskEl.textContent = secondary;
            }'''

new_sync = '''            function shouldShowNavInstall() {
              if (isStandalonePwa()) return false;
              if (deferredInstallPrompt) return true;
              // BIP lives on the top Next.js document when landing is iframed.
              if (isEmbeddedInParent()) return true;
              const os = detectOS();
              // Manual add-to-home / install paths (no one-tap BIP).
              if (os === 'ios' || os === 'mac') return true;
              return false;
            }

            function syncHeroCtas() {
              const pack = HERO_COPY[currentLocale] || HERO_COPY.en;
              const startEl = document.querySelector('[data-hero-cta="start"]');
              if (startEl && pack.ctaStart) startEl.textContent = pack.ctaStart;
              // Hero secondary CTA removed — PASS stays in pricing below.
              const deskBtn = document.getElementById('v2-hero-cta-desktop');
              if (deskBtn) deskBtn.hidden = true;

              const navBtn = document.getElementById('v2-nav-install');
              const navLabel = document.querySelector('[data-nav-install-label]');
              const labelText = pack.navInstall || (HERO_COPY.en && HERO_COPY.en.navInstall) || 'Install app';
              if (navLabel) navLabel.textContent = labelText;
              if (navBtn) {
                navBtn.setAttribute('aria-label', labelText);
                const show = shouldShowNavInstall();
                navBtn.hidden = !show;
                navBtn.classList.toggle('hidden', !show);
                navBtn.classList.toggle('inline-flex', show);
              }
            }'''

if old_sync not in text:
    raise SystemExit("syncHeroCtas block not found")
text = text.replace(old_sync, new_sync, 1)

# 6) Remove hero secondary click→pricing; wire nav install instead
old_wire = '''            syncHeroCtas();
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
            }
            const installModal = document.getElementById('v2-install-modal');'''

new_wire = '''            syncHeroCtas();
            const navInstallBtn = document.getElementById('v2-nav-install');
            if (navInstallBtn) {
              navInstallBtn.addEventListener('click', function () {
                void handleInstallClick();
              });
            }
            const installModal = document.getElementById('v2-install-modal');'''

if old_wire not in text:
    raise SystemExit("desktop CTA wire block not found")
text = text.replace(old_wire, new_wire, 1)

# isEmbeddedInParent is defined AFTER syncHeroCtas currently — shouldShowNavInstall calls it.
# Move isEmbeddedInParent (+ V2_PWA msg const) before shouldShowNavInstall, OR forward-declare.
# Current order after patch:
#   shouldShowNavInstall (uses isEmbeddedInParent)
#   syncHeroCtas
#   closeInstallModal...
#   V2_PWA_INSTALL_MSG
#   isEmbeddedInParent
# That's a TDZ/reference error if syncHeroCtas runs before isEmbeddedInParent is defined —
# but syncHeroCtas is only *called* later, after isEmbeddedInParent exists. Function decls
# are const function expressions — isEmbeddedInParent is a function declaration via
# `function isEmbeddedInParent()` so it's hoisted within the scope... Actually they're
# all `function name()` style inside a script block/callback. Let me check.

if text == orig:
    raise SystemExit("no changes made")

path.write_text(text, encoding="utf-8")
print("OK patched", path)
print("bytes", len(text.encode("utf-8")))
