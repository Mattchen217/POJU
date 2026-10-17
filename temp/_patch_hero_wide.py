from pathlib import Path
import re

path = Path("public/v2-landing.html")
t = path.read_text(encoding="utf-8")
orig = t

# Update title-type and sub-type sizes
t = re.sub(
    r"\.v2-hero-title-type\s*\{[^}]+\}",
    """.v2-hero-title-type {
            font-size: clamp(2.5rem, 4.5vw, 3.75rem);
        }""",
    t,
    count=1,
)
t = re.sub(
    r"\.v2-hero-sub-type\s*\{[^}]+\}",
    """.v2-hero-sub-type {
            font-size: clamp(1.125rem, 1.6vw, 1.25rem);
        }""",
    t,
    count=1,
)

# Replace ALL #v2-hero-title and #v2-hero-subtitle rule blocks with unified ones
# Remove duplicates by replacing each occurrence
title_css = """.v2-hero-copy {
            width: 100%;
            max-width: none; /* same column as glass: parent max-w-7xl + px-6 */
            display: flex;
            flex-direction: column;
            align-items: center;
            padding-top: 0.5rem;
            padding-bottom: 0.75rem;
        }
        #v2-hero-title {
            max-width: none !important;
            width: 100%;
            text-align: center;
            text-wrap: pretty;
            line-height: 1.28;
            letter-spacing: -0.01em;
        }
        html[lang="zh-CN"] #v2-hero-title,
        html[lang^="zh"] #v2-hero-title {
            line-height: 1.35;
        }
        #v2-hero-subtitle {
            max-width: none !important;
            width: 100%;
            text-align: center;
            text-wrap: pretty;
            line-height: 1.68;
            margin-top: 1.75rem;
        }
        html[lang="zh-CN"] #v2-hero-subtitle,
        html[lang^="zh"] #v2-hero-subtitle {
            line-height: 1.7;
        }"""

# Remove existing #v2-hero-title and #v2-hero-subtitle blocks (may duplicate)
t = re.sub(r"\s*#v2-hero-title\s*\{[^}]+\}", "\n", t)
t = re.sub(r"\s*#v2-hero-subtitle\s*\{[^}]+\}", "\n", t)

# Insert after .v2-hero-sub-type
m = re.search(r"\.v2-hero-sub-type\s*\{[^}]+\}", t)
if not m:
    raise SystemExit("sub-type missing after patch")
t = t[: m.end()] + "\n" + title_css + t[m.end() :]

# Markup: ensure foreground is full column; wrap badge+h1+sub+cta in v2-hero-copy optional
# Change class on foreground to emphasize full width - already max-w-7xl px-6
# Add v2-hero-copy wrapper around content inside foreground for padding-block
old_fg = '''<div class="v2-hero-foreground mx-auto flex max-w-7xl flex-col items-center px-6 text-center">
<div class="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-primary text-xs font-bold tracking-widest">'''

# Find actual badge line (icon may vary)
fg_pat = re.compile(
    r'(<div class="v2-hero-foreground mx-auto flex max-w-7xl flex-col items-center px-6 text-center">)\s*'
    r'(<div class="mb-8 inline-flex[\s\S]*?</div>\s*'
    r'<h1 id="v2-hero-title"[\s\S]*?</h1>\s*'
    r'<p id="v2-hero-subtitle"[\s\S]*?</p>\s*'
    r'<div class="v2-hero-ctas[\s\S]*?</div>\s*)'
    r'(</div>)',
    re.M,
)
m = fg_pat.search(t)
if not m:
    raise SystemExit("hero foreground block not found")
inner = m.group(2)
new_block = (
    m.group(1)
    + '\n<div class="v2-hero-copy">'
    + inner
    + "</div>\n"
    + m.group(3)
)
t = t[: m.start()] + new_block + t[m.end() :]

# Slightly bump hero top padding for height
t = t.replace(
    'id="v2-hero" class="relative pt-20 md:pt-24 lg:pt-28 overflow-hidden animate-fade-in-up"',
    'id="v2-hero" class="relative pt-24 md:pt-28 lg:pt-32 overflow-hidden animate-fade-in-up"',
    1,
)

if t == orig:
    raise SystemExit("no changes")
path.write_text(t, encoding="utf-8")

tt = path.read_text(encoding="utf-8")
assert "clamp(2.5rem, 4.5vw, 3.75rem)" in tt
assert "clamp(1.125rem, 1.6vw, 1.25rem)" in tt
assert "line-height: 1.28" in tt
assert "line-height: 1.35" in tt
assert "v2-hero-copy" in tt
assert "text-wrap: balance" not in tt or tt.count("text-wrap: balance") == 0
# title should not use balance
assert re.search(r"#v2-hero-title\s*\{[^}]*text-wrap:\s*pretty", tt)
print("local hero typography ok; unpushed")
print("title rules count", len(re.findall(r"#v2-hero-title\s*\{", tt)))
