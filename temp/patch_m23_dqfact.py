from pathlib import Path
p = Path(r"lib/poju/decision-intake/fresh-session-bootstrap.ts")
text = p.read_text(encoding="utf-8")
# add imports
if "buildRealityFact" not in text:
    text = text.replace(
        'import type { DIR } from "@/lib/poju/decision-context/types";',
        'import type { DIR } from "@/lib/poju/decision-context/types";\nimport { buildRealityFact } from "@/lib/poju/decision-context/fact-combination";\nimport { reaggregateDirs } from "@/lib/poju/decision-context/dir-aggregator";',
    )
old = '''  const fact = {
    fact_id: `fact_dq_${dc.context_id}`,
    statement: q.slice(0, 500),
    status: "unverified" as const,
    verification_level: "user_asserted" as const,
    user_confirmed: false,
    source_stage: "opening" as const,
    source_turn_id,
    fact_roles: ["decision_question"],
    related_dir_ids: ["DIR-DEF-QUESTION"],
    created_at: now,
    updated_at: now,
  };
  return {
    ...session,
    decision_context: {
      ...dc,
      reality_facts: [...(dc.reality_facts ?? []), fact],
      updated_at: now,
    },
  };
}'''
new = '''  const fact = buildRealityFact({
    fact_id: `fact_dq_${dc.context_id}`,
    statement: q.slice(0, 500),
    status: "unverified",
    verification_level: "user_asserted",
    source_stage: "opening",
    source_turn_id,
    fact_roles: ["decision_question"],
    related_dir_ids: ["DIR-DEF-QUESTION"],
    updated_at: now,
  });
  const reality_facts = [...(dc.reality_facts ?? []), fact];
  const dirs = reaggregateDirs(
    { ...dc, reality_facts },
    dc.dirs,
  );
  return {
    ...session,
    decision_context: {
      ...dc,
      reality_facts,
      dirs,
      updated_at: now,
    },
  };
}'''
if old not in text:
    raise SystemExit('fact block not found')
p.write_text(text.replace(old, new), encoding='utf-8')
print('seed fact uses buildRealityFact+reaggregate')

# check reaggregateDirs signature
