from pathlib import Path
import re

path = Path("public/v2-landing.html")
t = path.read_text(encoding="utf-8")
orig = t

en_eyebrow = "Stuck on a decision that won't let go?"
zh_eyebrow = "你被什么决定卡住了吗？"

# H1: Eastern OS gold + rest; allow soft wrap via existing title type — single block, Design can wrap by language
en_title = (
    '<span class="gold-gradient">Eastern OS</span> — rooted in Eastern decision models, '
    'a multi-turn dialogue that unsticks the step you\'re stuck on.'
)
zh_title = (
    '<span class="gold-gradient">Eastern OS</span> —— 以东方决策模型为根基，'
    '通过多轮对话的方式，帮你破开卡住的那一步。'
)

en_sub = (
    "Not another pile of opinions—a deep dialogue locked on the problem, "
    "a report you'll open again, plus required 30-day same-line reminders. "
    "We advise. You decide."
)
zh_sub = (
    "不是再多一堆意见——一场对准问题的深度对话，一份你会再打开的报告，"
    "必含 30 天同线提醒。我们给建议，决定权始终在你。"
)

# Static HTML defaults (EN)
t = re.sub(
    r'(<span id="v2-hero-trust">)[^<]*(</span>)',
    r'\1' + en_eyebrow.replace('\\', '\\\\') + r'\2',
    t,
    count=1,
)
t = re.sub(
    r'(<h1 id="v2-hero-title" class="font-display font-bold tracking-tight v2-hero-title-type">)\s*[\s\S]*?(</h1>)',
    r'\1\n' + en_title + r'\n\2',
    t,
    count=1,
)
t = re.sub(
    r'(<p id="v2-hero-subtitle" class="mt-7 leading-relaxed text-slate-400 v2-hero-sub-type">)\s*[\s\S]*?(</p>)',
    r'\1\n' + en_sub + r'\n\2',
    t,
    count=1,
)

def repl_locale(text, locale, eyebrow, title, subtitle):
    marker = f"              {locale}: {{"
    i = text.find(marker)
    if i < 0:
        raise SystemExit(f"missing {locale}")
    # eyebrow
    m = re.search(r"eyebrow:\s*'((?:\\'|[^'])*)'", text[i : i + 900])
    if not m:
        raise SystemExit(f"{locale} eyebrow")
    a, b = i + m.start(), i + m.end()
    eb = eyebrow.replace("\\", "\\\\").replace("'", "\\'")
    text = text[:a] + f"eyebrow: '{eb}'" + text[b:]
    # title
    m = re.search(r"title:\s*\n?\s*'((?:\\'|[^'])*)'", text[i : i + 1400])
    if not m:
        raise SystemExit(f"{locale} title")
    a, b = i + m.start(), i + m.end()
    ti = title.replace("\\", "\\\\").replace("'", "\\'")
    text = text[:a] + f"title:\n                  '{ti}'" + text[b:]
    # subtitle
    m = re.search(r"subtitle:\s*\n?\s*'((?:\\'|[^'])*)'", text[i : i + 1800])
    if not m:
        raise SystemExit(f"{locale} subtitle")
    a, b = i + m.start(), i + m.end()
    su = subtitle.replace("\\", "\\\\").replace("'", "\\'")
    text = text[:a] + f"subtitle:\n                  '{su}'" + text[b:]
    return text

t = repl_locale(t, "en", en_eyebrow, en_title, en_sub)
t = repl_locale(t, "zh", zh_eyebrow, zh_title, zh_sub)

# Drop v2-hero-title-l2 if unused in new single-line H1 (CSS can stay harmlessly)
if t == orig:
    raise SystemExit("no changes")
path.write_text(t, encoding="utf-8")

tt = path.read_text(encoding="utf-8")
assert "rooted in Eastern decision models" in tt
assert "以东方决策模型为根基" in tt
assert "必含 30 天同线提醒" in tt
assert "required 30-day" in tt
assert "千年" not in tt[tt.find("HERO_COPY"):tt.find("HERO_COPY")+2500] or True
# ensure no 千年 in en/zh hero blocks
en_chunk = tt[tt.find("en: {"):tt.find("zh: {")]
zh_chunk = tt[tt.find("zh: {"):tt.find("es: {")]
assert "千年" not in en_chunk and "千年" not in zh_chunk
assert "3000" not in en_chunk
print("hero v6 locked ok")
print("glass .30", "0.30" in tt)
print("section gap", "--eos-section-gap" in tt)
