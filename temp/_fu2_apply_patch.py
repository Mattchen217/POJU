from pathlib import Path

p = Path("lib/poju/decision-intake/apply-answer-to-dc.ts")
text = p.read_text(encoding="utf-8").replace("\r\n", "\n")

old = '''function alreadyMapped(dc: DecisionContext, turnId: string): boolean {
  if (dc.reality_facts.some((f) => f.source_turn_id === turnId)) return true;
  if (dc.constraints.some((c) => c.source_turn_id === turnId)) return true;
  return false;
}
'''

new = '''function alreadyMapped(dc: DecisionContext, turnId: string): boolean {
  if (dc.reality_facts.some((f) => f.source_turn_id === turnId)) return true;
  if (dc.constraints.some((c) => c.source_turn_id === turnId)) return true;
  return false;
}

function writeAlreadyPresent(
  dc: DecisionContext,
  turnId: string,
  kind: "reality_fact" | "constraint",
  statement: string,
): boolean {
  const norm = normalizeComparable(statement);
  if (kind === "reality_fact") {
    return dc.reality_facts.some(
      (f) =>
        f.source_turn_id === turnId &&
        normalizeComparable(f.statement) === norm,
    );
  }
  return dc.constraints.some(
    (c) =>
      c.source_turn_id === turnId &&
      normalizeComparable(c.statement) === norm,
  );
}

function uniqueRecordId(
  prefix: string,
  turnId: string,
  index: number,
  existing: Set<string>,
): string {
  const base = `${prefix}${turnId}_${index}`.slice(0, 80);
  if (!existing.has(base)) return base;
  let n = 1;
  while (true) {
    const candidate = `${prefix}${turnId}_${index}_p${n}`.slice(0, 80);
    if (!existing.has(candidate)) return candidate;
    n += 1;
  }
}
'''

if old not in text:
    raise SystemExit("alreadyMapped not found")
text = text.replace(old, new, 1)

old2 = '''  if (alreadyMapped(dc, turnId)) {
    return {
      session,
      applied: false,
      skipped_reason: "turn_already_mapped",
      fact_ids_written: [],
      constraint_ids_written: [],
    };
  }
'''

new2 = '''  const persistableWrites = event.proposed_writes.filter(
    (w) => w.kind === "reality_fact" || w.kind === "constraint",
  );
  const incrementalWrites = persistableWrites.filter(
    (w) => !writeAlreadyPresent(dc, turnId, w.kind, w.statement),
  );
  // Same source_turn_id may legally add previously unresolved statements
  // after role clarification. Replay of already-written statements stays
  // idempotent. Do not change Constraint verification_level hardcoding.
  if (alreadyMapped(dc, turnId) && incrementalWrites.length === 0) {
    return {
      session,
      applied: false,
      skipped_reason: "turn_already_mapped",
      fact_ids_written: [],
      constraint_ids_written: [],
    };
  }
'''

if old2 not in text:
    raise SystemExit("alreadyMapped early return not found")
text = text.replace(old2, new2, 1)

old3 = '''  for (let i = 0; i < event.proposed_writes.length; i++) {
    const w = event.proposed_writes[i]!;
    if (w.kind === "reality_fact") {
'''

new3 = '''  const existingFactIds = new Set(reality_facts.map((f) => f.fact_id));
  const existingConstraintIds = new Set(constraints.map((c) => c.constraint_id));

  for (let i = 0; i < event.proposed_writes.length; i++) {
    const w = event.proposed_writes[i]!;
    if (w.kind === "reality_fact" || w.kind === "constraint") {
      if (writeAlreadyPresent(dc, turnId, w.kind, w.statement)) {
        continue;
      }
    }
    if (w.kind === "reality_fact") {
'''

if old3 not in text:
    raise SystemExit("write loop not found")
text = text.replace(old3, new3, 1)

old4 = '''      const fact: RealityFact = buildRealityFact({
        fact_id: `fact_m1_${turnId}_${i}`.slice(0, 80),
'''
new4 = '''      const factId = uniqueRecordId("fact_m1_", turnId, i, existingFactIds);
      existingFactIds.add(factId);
      const fact: RealityFact = buildRealityFact({
        fact_id: factId,
'''
if old4 not in text:
    raise SystemExit("fact_id assign not found")
text = text.replace(old4, new4, 1)

old5 = '''      const c: Constraint = {
        constraint_id: `cst_m1_${turnId}_${i}`.slice(0, 80),
'''
new5 = '''      const constraintId = uniqueRecordId("cst_m1_", turnId, i, existingConstraintIds);
      existingConstraintIds.add(constraintId);
      const c: Constraint = {
        constraint_id: constraintId,
'''
if old5 not in text:
    raise SystemExit("constraint_id assign not found")
text = text.replace(old5, new5, 1)

p.write_text(text, encoding="utf-8", newline="\n")
print("apply-answer-to-dc patched")
