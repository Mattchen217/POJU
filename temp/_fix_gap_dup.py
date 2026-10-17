from pathlib import Path
import re
path = Path("public/v2-landing.html")
t = path.read_text(encoding="utf-8")
# replace the section gap rules block to avoid double-counting
old = """        #eos-landing-scenarios {
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
        }"""
new = """        /* One gap between blocks = padding-top on each following section (not pt+pb) */
        #eos-landing-scenarios,
        #v2-engines,
        #v2-methodology,
        #v2-team-section,
        #v2-pricing,
        #v2-faq {
            padding-top: var(--eos-section-gap) !important;
        }
        #eos-landing-scenarios,
        #v2-engines,
        #v2-methodology,
        #v2-team-section,
        #v2-pricing {
            padding-bottom: 0 !important;
        }
        #v2-faq {
            padding-bottom: var(--eos-section-gap) !important;
        }"""
if old not in t:
    raise SystemExit("old gap block not found")
path.write_text(t.replace(old, new, 1), encoding="utf-8")
print("deduped section gaps")
