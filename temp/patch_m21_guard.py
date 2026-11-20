from pathlib import Path
p = Path(r"scripts/test-m2-1-readiness-confirm-freeze.ts")
text = p.read_text(encoding="utf-8")
old = '''      let guard = 0;
      while (
        session!.decision_understanding?.readiness.can_ask !== false &&
        guard < 12
      ) {'''
new = '''      let guard = 0;
      // M2.3 Catalog scope seeds more critical DIRs; allow enough turns for
      // partial coverage / hard-budget stop (soft 12 / hard 15).
      while (
        session!.decision_understanding?.readiness.can_ask !== false &&
        guard < 20
      ) {'''
if old not in text:
    raise SystemExit('guard block not found')
p.write_text(text.replace(old, new), encoding='utf-8')
print('guard updated')
