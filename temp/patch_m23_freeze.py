from pathlib import Path

# 1) buildCatalogBlueprintScope — seed dirs from P0 DDRs + topic only
p = Path(r"lib/poju/decision-intake/blueprint.ts")
text = p.read_text(encoding="utf-8")

old = '''  const selectedDdrs: DdrDefinitionEntry[] = [];
  for (const ddr of ddrLoad.snapshot.entries) {
    if (ddr.topic_gated) continue;
    if (ddr.always_on) selectedDdrs.push(ddr);
  }
  if (topic.page_07_emit) {
    const ddr07 = ddrLoad.snapshot.by_id.get("DDR-07-TOPIC-DEPTH");
    if (ddr07) {
      selectedDdrs.push({
        ...ddr07,
        required_dir_ids: [...topic.topic_dir_ids],
      });
    }
  }

  const dirIdSet = new Set<string>();
  for (const ddr of selectedDdrs) {
    for (const id of ddr.required_dir_ids) {
      if (legalDirs.has(id)) dirIdSet.add(id);
    }
  }
  for (const id of topic.topic_dir_ids) {
    if (legalDirs.has(id)) dirIdSet.add(id);
  }
  for (const id of filtered.dir_ids) dirIdSet.add(id);'''

new = '''  const selectedDdrs: DdrDefinitionEntry[] = [];
  for (const ddr of ddrLoad.snapshot.entries) {
    if (ddr.topic_gated) continue;
    if (ddr.always_on) selectedDdrs.push(ddr);
  }
  if (topic.page_07_emit) {
    const ddr07 = ddrLoad.snapshot.by_id.get("DDR-07-TOPIC-DEPTH");
    if (ddr07) {
      selectedDdrs.push({
        ...ddr07,
        required_dir_ids: [...topic.topic_dir_ids],
      });
    }
  }

  // Initial askable DC seed = P0 DDR required DIRs + topic pack DIRs.
  // P1/P2-only DIRs remain on Blueprint.ddr_ids for report obligations but are
  // not forced into the first investigation wave (Adaptive Engine prioritizes P0).
  const dirIdSet = new Set<string>();
  for (const ddr of selectedDdrs) {
    if (ddr.priority !== "P0" && !ddr.topic_gated) continue;
    for (const id of ddr.required_dir_ids) {
      if (legalDirs.has(id)) dirIdSet.add(id);
    }
  }
  for (const id of topic.topic_dir_ids) {
    if (legalDirs.has(id)) dirIdSet.add(id);
  }
  for (const id of filtered.dir_ids) dirIdSet.add(id);'''

if old not in text:
    raise SystemExit('selectedDdrs block not found')
text = text.replace(old, new)

# Bump topic direction to P0 when building from topic category
text = text.replace(
'''    case "topic":
    case "support":
    default:
      return {
        id: "DIRN-TOPIC",
        label: "Topic-specific investigation",
        defaultPriority: "P1",
      };''',
'''    case "topic":
      return {
        id: "DIRN-TOPIC",
        label: "Topic-specific investigation",
        defaultPriority: "P0",
      };
    case "support":
    default:
      return {
        id: "DIRN-TOPIC",
        label: "Topic-specific investigation",
        defaultPriority: "P1",
      };''',
)

p.write_text(text, encoding="utf-8")
print("blueprint scope P0+topic")

# 2) OPT-CONSTRAINTS primary role hard_constraint only (soft supporting)
p2 = Path(r"lib/poju/decision-context/catalog/dir-definition-catalog.v1.ts")
t2 = p2.read_text(encoding="utf-8")
t2 = t2.replace(
    'required_fact_roles: ["hard_constraint", "soft_constraint"],',
    'required_fact_roles: ["hard_constraint"],',
)
p2.write_text(t2, encoding="utf-8")
print("OPT-CONSTRAINTS roles")

# 3) Seed opening decision_question fact in fresh-session-bootstrap
p3 = Path(r"lib/poju/decision-intake/fresh-session-bootstrap.ts")
t3 = p3.read_text(encoding="utf-8")
if "seedDecisionQuestionFact" not in t3:
    helper = '''
function seedDecisionQuestionFact(
  session: POJUSessionState,
  statement: string,
  source_turn_id: string,
  now: string,
): POJUSessionState {
  const dc = session.decision_context;
  if (!dc || dc.status !== "draft") return session;
  const q =
    dc.definition.decision_question?.trim() ||
    session.original_question?.trim() ||
    statement.trim();
  if (!q) return session;
  const hasRole = (dc.reality_facts ?? []).some((f) =>
    (f.fact_roles ?? []).includes("decision_question"),
  );
  if (hasRole) return session;
  if (!dc.dirs.some((d) => d.dir_id === "DIR-DEF-QUESTION")) return session;
  const fact = {
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
}

'''
    # insert before attachStarterDirsFallback
    anchor = "/** Last-resort only: attach starter DIRs"
    if anchor not in t3:
        raise SystemExit('anchor for helper not found')
    t3 = t3.replace(anchor, helper + anchor)
    # call after applyBlueprintInit in both paths - wrap applyBlueprintInit return
    t3 = t3.replace(
'''function applyBlueprintInit(
  session: POJUSessionState,
  statement: string,
  now: string,
  recompute: boolean,
): { session: POJUSessionState; scope_source: "catalog" | "starter_fallback" } {
  let current = withDecisionQuestion(session, statement, now);
  try {
    const bp = ensureDecisionBlueprint(current, {
      now,
      recompute_scope: recompute,
    });
    current = bp.session;''',
'''function applyBlueprintInit(
  session: POJUSessionState,
  statement: string,
  now: string,
  recompute: boolean,
  source_turn_id?: string,
): { session: POJUSessionState; scope_source: "catalog" | "starter_fallback" } {
  let current = withDecisionQuestion(session, statement, now);
  try {
    const bp = ensureDecisionBlueprint(current, {
      now,
      recompute_scope: recompute,
    });
    current = bp.session;
    current = seedDecisionQuestionFact(
      current,
      statement,
      source_turn_id ?? `opening:${current.session_id}`,
      now,
    );''',
    )
    # Also in catch path after fallback bp
    t3 = t3.replace(
'''    const bp = ensureDecisionBlueprint(current, {
      now,
      recompute_scope: true,
    });
    return {
      session: bp.session,
      scope_source: "starter_fallback",
    };
  }
}''',
'''    const bp = ensureDecisionBlueprint(current, {
      now,
      recompute_scope: true,
    });
    let fallbackSession = bp.session;
    fallbackSession = seedDecisionQuestionFact(
      fallbackSession,
      statement,
      source_turn_id ?? `opening:${fallbackSession.session_id}`,
      now,
    );
    return {
      session: fallbackSession,
      scope_source: "starter_fallback",
    };
  }
}''',
    )
    # Update call sites to pass source_turn_id - in bootstrapFreshSessionMainLoop
    t3 = t3.replace(
      "const applied = applyBlueprintInit(current, statement, input.now, false);",
      "const applied = applyBlueprintInit(current, statement, input.now, false, input.source_turn_id);",
    )
    t3 = t3.replace(
      "const applied = applyBlueprintInit(current, statement, input.now, true);",
      "const applied = applyBlueprintInit(current, statement, input.now, true, input.source_turn_id);",
    )
    # third call with object form
    t3 = t3.replace(
'''    const applied = applyBlueprintInit(
      current,
      statement,
      input.now,
      !(current.decision_context?.dirs ?? []).some(
        (d) => d.id_lifecycle === "active",
      ),
    );''',
'''    const applied = applyBlueprintInit(
      current,
      statement,
      input.now,
      !(current.decision_context?.dirs ?? []).some(
        (d) => d.id_lifecycle === "active",
      ),
      input.source_turn_id,
    );''',
    )
    p3.write_text(t3, encoding="utf-8")
    print("seedDecisionQuestionFact added")
else:
    print("seedDecisionQuestionFact already present")
