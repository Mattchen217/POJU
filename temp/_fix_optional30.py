# -*- coding: utf-8 -*-
from pathlib import Path

path = Path("public/v2-landing.html")
text = path.read_text(encoding="utf-8")

replacements = [
    # EN: drop "optional" before 30-day reminders (Hero + scenarios)
    (
        "plus optional 30-day same-line reminders",
        "plus 30-day same-line reminders",
    ),
    (
        "dialogue → report → optional 30-day same-line reminders",
        "dialogue → report → 30-day same-line reminders",
    ),
    # ZH: 可选 → 必含 for 30-day same-line reminders
    (
        "可选 30 天同线提醒",
        "必含 30 天同线提醒",
    ),
]

for old, new in replacements:
    count = text.count(old)
    print(f"count={count} for: {old!r}")
    if count == 0:
        raise SystemExit(f"MISSING: {old!r}")
    text = text.replace(old, new)

# Sanity: no remaining "optional 30" / "可选 30"
bad_en = "optional 30-day" in text or "optional 30 day" in text.lower()
bad_zh = "可选 30 天" in text
print("remaining optional 30-day:", "optional 30-day" in text)
print("remaining 可选 30 天:", "可选 30 天" in text)

# Confirm good strings present
for s in [
    "plus 30-day same-line reminders",
    "dialogue → report → 30-day same-line reminders",
    "必含 30 天同线提醒",
]:
    print(f"present {s!r}:", s in text)

# Ensure we didn't invent engine names etc.
assert "eos-landing-scenarios" in text

path.write_text(text, encoding="utf-8", newline="\n")
print("patched ok")
