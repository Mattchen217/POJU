from pathlib import Path

# Fix understanding-state: hoist ddrLoad outside loop
p = Path(r"lib/poju/decision-intake/understanding-state.ts")
text = p.read_text(encoding="utf-8")
needle = '''  const understood: UnderstoodItem[] = [];
  const needs: NeedItem[] = [];

  for (const dir of dc.dirs) {'''
repl = '''  const understood: UnderstoodItem[] = [];
  const needs: NeedItem[] = [];
  const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);

  for (const dir of dc.dirs) {'''
if needle not in text:
    raise SystemExit('hoist anchor not found')
text = text.replace(needle, repl)
text = text.replace(
    '''    const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);
    const gate = ddrLoad.ok''',
    '''    const gate = ddrLoad.ok''',
)
p.write_text(text, encoding='utf-8')
print('hoisted ddrLoad')

# answer-interpretation
p2 = Path(r"lib/poju/decision-intake/answer-interpretation.ts")
t2 = p2.read_text(encoding='utf-8')
if 'resolveDdrIdsForDir' not in t2:
    t2 = t2.replace(
        'import type { AnswerClass, AnswerEvent, ProposedWrite } from "./types";',
        'import type { AnswerClass, AnswerEvent, ProposedWrite } from "./types";\nimport { resolveDdrIdsForDir } from "./blueprint";',
    )
t2 = t2.replace('ddr_ids: [`DDR_FOR_${m[1]}`],', 'ddr_ids: resolveDdrIdsForDir(m[1], session.decision_blueprint),')
t2 = t2.replace('ddr_ids: [`DDR_FOR_${open.dir_id}`],', 'ddr_ids: resolveDdrIdsForDir(open.dir_id, session.decision_blueprint),')
if 'DDR_FOR_' in t2:
    raise SystemExit('DDR_FOR_ still present in answer-interpretation')
p2.write_text(t2, encoding='utf-8')
print('answer-interpretation patched')

# adaptive-turn: pass blueprint into buildIntakeCandidatesFromDc
p3 = Path(r"lib/poju/decision-intake/adaptive-turn.ts")
t3 = p3.read_text(encoding='utf-8')
old = 'const candidates = buildIntakeCandidatesFromDc(dc).map((c) => {'
new = 'const candidates = buildIntakeCandidatesFromDc(dc, blueprint).map((c) => {'
if old not in t3:
    raise SystemExit('adaptive-turn candidates line not found')
t3 = t3.replace(old, new)
# Also filter any candidate outside blueprint / without ddr
extra = '''  }).filter((c) => {
    const dirId = c.dir_ids[0];
    if (!dirId) return true;
    const used = budget.depth_by_dir[dirId] ?? 0;
    return used < blueprint.question_budget.depth_per_direction;
  });'''
# The existing filter already does depth — enhance the map/filter chain to also enforce blueprint + ddr
# Find the filter block and replace
import re
pat = r'const candidates = buildIntakeCandidatesFromDc\(dc, blueprint\)\.map\(\(c\) => \{.*?\}\)\.filter\(\(c\) => \{.*?\}\);'
m = re.search(pat, t3, flags=re.S)
if not m:
    raise SystemExit('candidates chain not found for replace')
replacement = '''const candidates = buildIntakeCandidatesFromDc(dc, blueprint).map((c) => {
    const dirId = c.dir_ids[0];
    const depth = dirId ? (budget.depth_by_dir[dirId] ?? 0) + 1 : c.depth;
    // Filter completed dirs already handled in builder; enforce depth cap here.
    return { ...c, depth, repetition_count: Math.max(0, depth - 1) };
  }).filter((c) => {
    if (!c.ddr_ids.length || c.ddr_ids.some((id) => id.startsWith("DDR_FOR_"))) {
      return false;
    }
    for (const dirId of c.dir_ids) {
      if (!blueprint.dir_ids.includes(dirId)) return false;
    }
    const dirId = c.dir_ids[0];
    if (!dirId) return true;
    const used = budget.depth_by_dir[dirId] ?? 0;
    return used < blueprint.question_budget.depth_per_direction;
  });'''
t3 = t3[:m.start()] + replacement + t3[m.end():]
p3.write_text(t3, encoding='utf-8')
print('adaptive-turn patched')
