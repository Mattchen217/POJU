from pathlib import Path
p = Path(r"scripts/test-m1-r-fresh-session-main-loop.ts")
t = p.read_text(encoding="utf-8")
t2 = t.replace(
    'assert.equal(AIV, "deterministic_m1_v1_simplified");\n      assert.equal(QGV, "template_m1_v1_simplified");',
    'assert.equal(AIV, "deterministic_m2_4_r1");\n      assert.equal(QGV, "gap_driven_m2_4_r1");',
)
# Also rename the check label
t2 = t2.replace(
    'M1R-static v1 simplified markers present',
    'M1R-static Phase4 answer/ask version markers present',
)
if t2 == t:
    raise SystemExit('no change')
p.write_text(t2, encoding='utf-8')
print('updated m1-r version markers')
