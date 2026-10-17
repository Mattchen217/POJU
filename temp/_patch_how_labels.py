# -*- coding: utf-8 -*-
from pathlib import Path
import re

path = Path(r"D:/POJU/pojulife/public/v2-landing.html")
text = path.read_text(encoding="utf-8")

# CSS for flash arrow
css_anchor = "        #v2-methodology .v2-method-left-art img {"
# better: add after how-get section gap if present, or after methodology art CSS
css_insert = """
        /* How+Get stage label: step words + flash arrow */
        #eos-landing-how-get .eos-how-get-label-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
        }
        #eos-landing-how-get .eos-how-get-label-left {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            min-width: 0;
        }
        #eos-landing-how-get .eos-how-get-label-icon {
            font-size: 1.05rem;
            line-height: 1;
            color: #D4AF37;
            flex-shrink: 0;
        }
        #eos-landing-how-get .eos-how-get-label-text {
            color: #D4AF37;
            font-weight: 700;
            font-size: 0.875rem;
            letter-spacing: 0.02em;
        }
        @media (min-width: 768px) {
            #eos-landing-how-get .eos-how-get-label-text { font-size: 1rem; }
        }
        #eos-landing-how-get .eos-how-get-flash-arrow {
            color: #D4AF37;
            font-size: 1.125rem;
            font-weight: 700;
            line-height: 1;
            flex-shrink: 0;
            animation: eos-how-get-arrow-flash 1.4s ease-in-out infinite;
        }
        @keyframes eos-how-get-arrow-flash {
            0%, 100% { opacity: 0.35; transform: translateX(0); }
            50% { opacity: 1; transform: translateX(4px); }
        }
        @media (prefers-reduced-motion: reduce) {
            #eos-landing-how-get .eos-how-get-flash-arrow {
                animation: none;
                opacity: 0.85;
                transform: none;
            }
        }
"""

if "eos-how-get-flash-arrow" not in text:
    # insert before methodology left-art or after methodology type hierarchy block end
    marker = "        /* Methodology cards: type hierarchy + mid/right art fill (local Design preview) */"
    if marker in text:
        text = text.replace(marker, css_insert + "\n" + marker, 1)
    else:
        # fallback: before </style> first occurrence in head is hard; use #eos-landing-how-get padding rule
        m = re.search(r"(#eos-landing-how-get,\s*\n\s*#v2-team-section)", text)
        if not m:
            raise SystemExit("no CSS insert anchor")
        # insert after section gap block - find end of #v2-faq padding-bottom block near start
        faq = "        #v2-faq {\n            padding-bottom: var(--eos-section-gap) !important;\n        }"
        if faq in text and "eos-how-get-flash-arrow" not in text:
            text = text.replace(faq, faq + "\n" + css_insert, 1)
        else:
            raise SystemExit("css insert failed")

# Replace each stage label div
old_label_re = re.compile(
    r'<div class="text-primary font-display font-bold text-sm md:text-base tracking-wide mb-3" data-howget="(stage(\d)\.label)">0\2</div>'
)

def repl_label(m):
    key = m.group(1)
    n = m.group(2)
    # default EN text Step N; zh via i18n
    default = f"Step {n}"
    return (
        f'<div class="eos-how-get-label-row">'
        f'<div class="eos-how-get-label-left">'
        f'<span class="material-icons-outlined eos-how-get-label-icon" aria-hidden="true">trip_origin</span>'
        f'<span class="eos-how-get-label-text font-display" data-howget="{key}">{default}</span>'
        f'</div>'
        f'<span class="eos-how-get-flash-arrow" aria-hidden="true">→</span>'
        f'</div>'
    )

new_text, nsub = old_label_re.subn(repl_label, text)
if nsub != 5:
    # try more flexible pattern
    print("strict replace count", nsub)
    old_label_re2 = re.compile(
        r'<div class="text-primary font-display font-bold text-sm md:text-base tracking-wide mb-3" data-howget="(stage(\d)\.label)">[^<]*</div>'
    )
    new_text, nsub = old_label_re2.subn(repl_label, text)
    print("flex replace count", nsub)
if nsub != 5:
    raise SystemExit(f"expected 5 label replaces, got {nsub}")
text = new_text

# Update HOW_GET_COPY labels
zh_steps = {1: "第一步", 2: "第二步", 3: "第三步", 4: "第四步", 5: "第五步"}
for i in range(1, 6):
    text = text.replace(f'"stage{i}.label": "0{i}"', f'"stage{i}.label": "Step {i}"', 1)
    # ZH block may use same after en - need replace both. After first replace en is Step i.
    # ZH originally also "01" etc.
    
# Fix ZH - they might still be "01" if we only replaced one each. Count remaining.
# Replace remaining 0N labels in copy object for zh section
for i in range(1, 6):
    # replace zh labels that are still 0i - the second occurrence of stageN.label
    needle = f'"stage{i}.label": "0{i}"'
    if needle in text:
        text = text.replace(needle, f'"stage{i}.label": "{zh_steps[i]}"', 1)
    # Also if en was already Step and zh still 01:
    needle2 = f'"stage{i}.label": "0{i}"'
    
# After en→Step, zh should still be 01. Replace those.
for i in range(1, 6):
    # find zh: look for pattern after zh: {
    pass

# Safer: replace any remaining "stageN.label": "0N"
for i in range(1, 6):
    while f'"stage{i}.label": "0{i}"' in text:
        # Prefer ZH words for remaining (en already Step)
        text = text.replace(f'"stage{i}.label": "0{i}"', f'"stage{i}.label": "{zh_steps[i]}"', 1)

# Verify en labels are Step
for i in range(1, 6):
    if f'"stage{i}.label": "Step {i}"' not in text:
        print("WARN missing EN", i)
    if f'"stage{i}.label": "{zh_steps[i]}"' not in text:
        print("WARN missing ZH", i)

path.write_text(text, encoding="utf-8")
print("patched labels", nsub)
print("flash css", "eos-how-get-flash-arrow" in text)
print("no bare 01 badge div", 'data-howget="stage1.label">01<' not in text)
