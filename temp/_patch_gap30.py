from pathlib import Path
import re

path = Path("public/v2-landing.html")
t = path.read_text(encoding="utf-8")
orig = t

# 1) glass 30%
t = re.sub(
    r"(\.v2-glass-strip\s*\{[^}]*?background:\s*)rgba\(16,\s*20,\s*28,\s*0\.\d+\)",
    r"\1rgba(16, 20, 28, 0.30)",
    t,
    count=1,
)

# 2) section gap token — match current hero pb scale (48 / 56 / 64)
gap_css = """
        /* Unified section gap = Hero CTA → glass top (hero padding-bottom) */
        :root {
            --eos-section-gap: 3rem; /* 48px — pb-12 */
        }
        @media (min-width: 768px) {
            :root { --eos-section-gap: 3.5rem; } /* 56px — md:pb-14 */
        }
        @media (min-width: 1024px) {
            :root { --eos-section-gap: 4rem; } /* 64px — lg:pb-16 */
        }
        #v2-hero {
            padding-bottom: var(--eos-section-gap) !important;
        }
        #v2-product-preview.v2-glass-strip {
            /* internal py stays for carousel inset; no extra outer section gap */
            margin-top: 0;
            margin-bottom: 0;
        }
        #eos-landing-scenarios {
            padding-top: var(--eos-section-gap) !important;
            padding-bottom: var(--eos-section-gap) !important;
        }
        #v2-engines {
            padding-top: 0 !important;
            padding-bottom: var(--eos-section-gap) !important;
        }
        #v2-methodology {
            padding-top: var(--eos-section-gap) !important;
            padding-bottom: var(--eos-section-gap) !important;
        }
        #v2-team-section {
            padding-top: var(--eos-section-gap) !important;
            padding-bottom: var(--eos-section-gap) !important;
        }
        #v2-pricing {
            padding-top: var(--eos-section-gap) !important;
            padding-bottom: var(--eos-section-gap) !important;
        }
        #v2-faq {
            padding-top: var(--eos-section-gap) !important;
            padding-bottom: var(--eos-section-gap) !important;
        }
"""

if "--eos-section-gap" not in t:
    # insert after .v2-glass-strip block
    m = re.search(r"\.v2-glass-strip\s*\{[^}]+\}", t)
    if not m:
        raise SystemExit("glass-strip missing")
    t = t[: m.end()] + "\n" + gap_css + t[m.end() :]
else:
    raise SystemExit("gap already present — edit manually")

# Soften conflicting tallwind pb/pt on hero class string (CSS !important overrides; also clean classes for clarity)
t = t.replace(
    'id="v2-hero" class="relative pt-20 pb-12 md:pt-24 md:pb-14 lg:pt-28 lg:pb-16 overflow-hidden animate-fade-in-up"',
    'id="v2-hero" class="relative pt-20 md:pt-24 lg:pt-28 overflow-hidden animate-fade-in-up"',
    1,
)
t = t.replace(
    'id="eos-landing-scenarios" class="pt-4 pb-20 md:pt-6 relative overflow-hidden animate-fade-in-up"',
    'id="eos-landing-scenarios" class="relative overflow-hidden animate-fade-in-up"',
    1,
)
t = t.replace(
    'id="v2-engines" class="pt-10 pb-24 md:pt-14 relative overflow-hidden animate-fade-in-up"',
    'id="v2-engines" class="relative overflow-hidden animate-fade-in-up"',
    1,
)
# methodology / team / pricing / faq — strip py-24 / pt-24 pb-28 so variable wins cleanly
t = t.replace(
    'class="py-24 bg-slate-50 dark:bg-slate-900/30 relative overflow-hidden animate-fade-in-up" style="animation-delay: 0.6s;" id="v2-methodology"',
    'class="bg-slate-50 dark:bg-slate-900/30 relative overflow-hidden animate-fade-in-up" style="animation-delay: 0.6s;" id="v2-methodology"',
    1,
)
t = t.replace(
    'class="pt-24 pb-28 relative reveal" id="v2-team-section"',
    'class="relative reveal" id="v2-team-section"',
    1,
)
t = t.replace(
    'class="py-24 relative overflow-hidden reveal" id="v2-pricing"',
    'class="relative overflow-hidden reveal" id="v2-pricing"',
    1,
)
t = t.replace(
    'class="py-24 bg-slate-50 dark:bg-slate-900/50 relative overflow-hidden reveal" id="v2-faq"',
    'class="bg-slate-50 dark:bg-slate-900/50 relative overflow-hidden reveal" id="v2-faq"',
    1,
)

if t == orig:
    raise SystemExit("no changes")
path.write_text(t, encoding="utf-8")

# verify
t2 = path.read_text(encoding="utf-8")
assert "rgba(16, 20, 28, 0.30)" in t2
assert "--eos-section-gap: 3.5rem" in t2
assert "--eos-section-gap: 4rem" in t2
print("ok glass .30 + section gap 48/56/64px")
print("status: local unpushed")
