from pathlib import Path
import re

path = Path("public/v2-landing.html")
t = path.read_text(encoding="utf-8")
orig = t

en_eyebrow = "Stuck on a decision that won't let go?"
en_title = (
    '<span class="gold-gradient">Eastern OS</span> unsticks the call that won\'t leave you alone.'
    '<span class="v2-hero-title-l2">Walk out with a main path—and a backup you can live with.</span>'
)
en_sub = (
    "Not another pile of opinions—a deep dialogue locked on the problem, "
    "a report you'll open again, plus 30-day same-line reminders. We advise. You decide."
)

zh_eyebrow = "你被什么决定卡住了吗？"
zh_title = (
    '<span class="gold-gradient">Eastern OS</span> 帮你破开卡住的那一步。'
    '<span class="v2-hero-title-l2">带走主路径，和一条你真能过的备用。</span>'
)
zh_sub = (
    "不是再多一堆意见——一场对准问题的深度对话，一份你会再打开的报告，还有 30 天同线提醒。"
    "我们给建议，决定权始终在你。"
)

# --- Static HTML (default EN) ---
# capsule
old_trust = '<span id="v2-hero-trust">That decision won\'t leave you alone.</span>'
new_trust = f'<span id="v2-hero-trust">{en_eyebrow}</span>'
if old_trust not in t:
    raise SystemExit("static trust not found")
t = t.replace(old_trust, new_trust, 1)

# h1 - match current multiline or single
h1_pat = re.compile(
    r'(<h1 id="v2-hero-title" class="font-display font-bold tracking-tight v2-hero-title-type">)\s*'
    r'[\s\S]*?'
    r'(</h1>)',
    re.M,
)
m = h1_pat.search(t)
if not m:
    raise SystemExit("h1 not found")
t = t[: m.start()] + m.group(1) + "\n" + en_title + "\n" + m.group(2) + t[m.end() :]

# subtitle
sub_pat = re.compile(
    r'(<p id="v2-hero-subtitle" class="mt-7 leading-relaxed text-slate-400 v2-hero-sub-type">)\s*'
    r'[\s\S]*?'
    r'(</p>)',
    re.M,
)
m = sub_pat.search(t)
if not m:
    raise SystemExit("subtitle not found")
# escape for HTML body - use plain text
t = t[: m.start()] + m.group(1) + "\n" + en_sub + "\n" + m.group(2) + t[m.end() :]

# --- HERO_COPY en ---
def repl_hero_locale(text, locale, eyebrow, title, subtitle):
    # find locale block start
    marker = f"              {locale}: {{"
    i = text.find(marker)
    if i < 0:
        raise SystemExit(f"{locale} block missing")
    # only replace within first ~800 chars of hero fields
    # eyebrow
    m = re.search(r"eyebrow:\s*'((?:\\'|[^'])*)'", text[i : i + 900])
    if not m:
        raise SystemExit(f"{locale} eyebrow missing")
    abs_start = i + m.start()
    abs_end = i + m.end()
    text = text[:abs_start] + f"eyebrow: '{eyebrow.replace(chr(39), chr(92)+chr(39))}'" + text[abs_end:]

    # title (may be multiline)
    m = re.search(
        r"title:\s*\n?\s*'((?:\\'|[^'])*)'",
        text[i : i + 1200],
    )
    if not m:
        raise SystemExit(f"{locale} title missing")
    abs_start = i + m.start()
    abs_end = i + m.end()
    # title has no unescaped single quotes in our new strings except won't
    title_esc = title.replace("\\", "\\\\").replace("'", "\\'")
    text = text[:abs_start] + f"title:\n                  '{title_esc}'" + text[abs_end:]

    # subtitle
    m = re.search(
        r"subtitle:\s*\n?\s*'((?:\\'|[^'])*)'",
        text[i : i + 1600],
    )
    if not m:
        raise SystemExit(f"{locale} subtitle missing")
    abs_start = i + m.start()
    abs_end = i + m.end()
    sub_esc = subtitle.replace("\\", "\\\\").replace("'", "\\'")
    text = text[:abs_start] + f"subtitle:\n                  '{sub_esc}'" + text[abs_end:]
    return text

t = repl_hero_locale(t, "en", en_eyebrow, en_title, en_sub)
t = repl_hero_locale(t, "zh", zh_eyebrow, zh_title, zh_sub)

# CSS for L2
if ".v2-hero-title-l2" not in t:
    css = """
        .v2-hero-title-l2 {
            display: block;
            margin-top: 0.28em;
        }
"""
    anchor = ".v2-hero-title-type {"
    ai = t.find(anchor)
    if ai < 0:
        raise SystemExit("title-type css missing")
    # insert after the title-type rule
    end = t.find("}", ai)
    t = t[: end + 1] + "\n" + css + t[end + 1 :]

if t == orig:
    raise SystemExit("no changes")
path.write_text(t, encoding="utf-8")
print("patched v4.1")
# verify
assert en_eyebrow in path.read_text(encoding="utf-8")
assert "帮你破开卡住的那一步" in path.read_text(encoding="utf-8")
assert "v2-hero-title-l2" in path.read_text(encoding="utf-8")
assert 'gold-gradient">Eastern OS' in path.read_text(encoding="utf-8")
print("verify ok")
