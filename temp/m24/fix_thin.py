from pathlib import Path
p = Path(r"lib/poju/decision-intake/answer-interpretation.ts")
t = p.read_text(encoding="utf-8")
old = '''  // empty / invalid
  if (!t) return { cls: "invalid_input", notes: ["empty"] };'''
new = '''  // empty / invalid — keep CJK single-ack (嗯/哦) as invalid so they do not write DC
  if (!t || t.length < 2) return { cls: "invalid_input", notes: ["empty"] };'''
if old not in t:
    raise SystemExit('empty check missing')
t = t.replace(old, new)
old2 = '''  // clear vs partial — content-based, not length-alone
  const hasConcrete =
    /\\d/.test(t) ||
    /(方案|选项|公司|城市|家庭|责任|风险|期限|成本|收入|离职|留下)/.test(t);
  if (hasConcrete && t.length >= 6) {
    return { cls: "clear_answer", notes: ["clear"] };
  }
  if (t.length >= 4) {
    return { cls: "partial_answer", notes: ["partial"] };
  }
  return { cls: "partial_answer", notes: ["thin_but_substantive"] };
}'''
new2 = '''  // clear vs partial — content-based, not length-alone
  const hasConcrete =
    /\\d/.test(t) ||
    /(方案|选项|公司|城市|家庭|责任|风险|期限|成本|收入|离职|留下)/.test(t);
  if (hasConcrete && t.length >= 6) {
    return { cls: "clear_answer", notes: ["clear"] };
  }
  if (t.length >= 4) {
    return { cls: "partial_answer", notes: ["partial"] };
  }
  // Too thin to be a fact write (preserves prior invalid behavior for "嗯" etc.)
  return { cls: "invalid_input", notes: ["too_thin"] };
}'''
if old2 not in t:
    raise SystemExit('clear/partial block missing')
p.write_text(t.replace(old2, new2), encoding='utf-8')
print('fixed thin-answer invalid_input')
