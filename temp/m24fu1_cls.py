from pathlib import Path
p = Path("lib/poju/decision-intake/answer-interpretation.ts")
t = p.read_text(encoding="utf-8")
old = '''  // explicit contradiction before bare correction when contradiction markers present
  if (CONTRADICTION_RE.test(t)) {
    return { cls: "contradiction", notes: ["contradiction"] };
  }
  // "不是…而是" often contradiction with prior
  if (/不是.+而是/.test(t)) {
    return { cls: "contradiction", notes: ["contradiction_reframing"] };
  }

  // explicit correction
  if (CORRECTION_RE.test(t)) {
    return { cls: "correction", notes: ["correction"] };
  }'''
new = '''  // explicit correction (before contradiction markers that may co-occur)
  if (CORRECTION_RE.test(t) && !CONTRADICTION_RE.test(t)) {
    return { cls: "correction", notes: ["correction"] };
  }

  // explicit contradiction
  if (CONTRADICTION_RE.test(t) || (CORRECTION_RE.test(t) && CONTRADICTION_RE.test(t))) {
    return { cls: "contradiction", notes: ["contradiction"] };
  }
  // "不是…而是" often contradiction with prior
  if (/不是.+而是/.test(t)) {
    return { cls: "contradiction", notes: ["contradiction_reframing"] };
  }'''
if old not in t:
    raise SystemExit('classify block not found')
p.write_text(t.replace(old, new, 1), encoding='utf-8')
print('classify order fixed')
