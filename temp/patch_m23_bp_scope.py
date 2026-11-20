from pathlib import Path
p = Path(r"lib/poju/decision-intake/blueprint.ts")
text = p.read_text(encoding="utf-8")

# Replace the main body of ensureDecisionBlueprint after the existing-blueprint early return
# and before "const scope = buildCatalogBlueprintScope"

marker = "  const scope = buildCatalogBlueprintScope({"
idx = text.find(marker)
if idx < 0:
    raise SystemExit("scope marker not found")

# Find the start of ensureDecisionBlueprint's decision_question block - we'll rewrite from
# after early-return through the return statement.

# Locate function end by finding the last return of ensureDecisionBlueprint before directionIdForDir
end_marker = "\nexport function directionIdForDir("
end = text.find(end_marker)
if end < 0:
    raise SystemExit("directionIdForDir not found")

# Find start: after early-return block's closing, the decision_question already computed.
# Actually rewrite from `const decision_question` through end of function.

start_marker = "  const decision_question =\n    dc0.definition.decision_question ??"
start = text.find(start_marker)
if start < 0:
    raise SystemExit("decision_question start not found")

new_body = r'''  const decision_question =
    dc0.definition.decision_question ??
    session.original_question ??
    session.agent_v2?.original_question ??
    null;
  const extra = [
    decision_question ?? "",
    session.agent_v2?.core_dilemma?.concrete_event ?? "",
    session.agent_v2?.desired_direction?.wants ?? "",
  ].join("\n");

  const existing = session.decision_blueprint;
  if (
    existing &&
    existing.context_id === dc0.context_id &&
    existing.session_id === session.session_id &&
    existing.dir_ids.length > 0 &&
    !opts?.recompute_scope
  ) {
    const missing = dc0.dirs
      .filter(
        (d) =>
          d.id_lifecycle !== "deprecated" &&
          !existing.dir_ids.includes(d.dir_id),
      )
      .map((d) => d.dir_id);
    if (missing.length === 0) {
      return {
        session,
        blueprint: existing,
        created: false,
        meta: {
          scope_source: existing.scope_source ?? "catalog",
          topic: {
            topic_tags: (existing.topic_tags as TopicClassifyResult["topic_tags"]) ?? [
              "strategic_choice",
            ],
            page_07_emit: existing.page_07_emit ?? false,
            topic_dir_ids: [],
            confidence: "high",
            classifier: "deterministic_m23_v1",
            notes: ["existing_blueprint"],
            used_uncertain_fallback: false,
          },
          rejected_ids: [],
          selected_ddr_ids: existing.ddr_ids ?? [],
        },
      };
    }
  }

  const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);
  const dirLoad = loadDirDefinitionCatalog(ACTIVE_DIR_DEFINITION_CATALOG_VERSION);
  if (!ddrLoad.ok || !dirLoad.ok) {
    throw new Error(
      `ensureDecisionBlueprint: catalog_unavailable:${!dirLoad.ok ? "dir" : "ddr"}`,
    );
  }

  const topic = classifyDecisionTopic({
    decision_question,
    extra_text: extra,
  });

  const activeOnDc = dc0.dirs.filter((d) => d.id_lifecycle === "active");
  /**
   * Production fresh bootstrap passes recompute_scope=true → full Catalog scope.
   * When DC already carries active DIRs and recompute is false (e.g. test seeds /
   * mid-loop), validate existing DIRs against Catalog without silently expanding
   * to the full always-on set.
   */
  const useFullCatalogScope =
    Boolean(opts?.recompute_scope) || activeOnDc.length === 0;

  let scope_source: BlueprintScopeSource = "catalog";
  let dir_defs: DirDefinitionEntry[] = [];
  let ddr_ids: string[] = [];
  let rejected_ids: string[] = [];
  let ddr_version = ddrLoad.snapshot.ddr_catalog_version;
  let dir_catalog_version = dirLoad.snapshot.dir_catalog_version;

  if (useFullCatalogScope) {
    const scope = buildCatalogBlueprintScope({
      decision_question,
      extra_text: extra,
      proposed_dir_ids: opts?.proposed_dir_ids,
      proposed_ddr_ids: opts?.proposed_ddr_ids,
      include_stakeholders: stakeholdersHint(extra),
    });
    if (scope.ok) {
      dir_defs = scope.dir_defs;
      ddr_ids = scope.ddr_ids;
      rejected_ids = scope.rejected_ids;
      ddr_version = scope.ddr_version;
      dir_catalog_version = scope.dir_catalog_version;
      scope_source = "catalog";
    } else {
      scope_source = "starter_fallback";
      rejected_ids = scope.rejected_ids;
      const fallbackIds = [
        "DIR-OPT-ON-TABLE",
        "DIR-STATUS-QUO",
        "DIR-OPT-CONSTRAINTS",
        "DIR-RISK-TOLERANCE",
      ];
      for (const id of fallbackIds) {
        const def = dirLoad.snapshot.by_id.get(id);
        if (def) dir_defs.push(def);
      }
      const set = new Set<string>();
      for (const d of dir_defs) {
        for (const id of ddrLoad.snapshot.dir_to_ddr.get(d.dir_id) ?? []) {
          set.add(id);
        }
      }
      ddr_ids = [...set];
    }
  } else {
    // Catalog-validate DIRs already on DC; reject illegal ids.
    const legal = new Set(dirLoad.snapshot.by_id.keys());
    for (const dir of activeOnDc) {
      if (!legal.has(dir.dir_id)) {
        rejected_ids.push(dir.dir_id);
        continue;
      }
      const def = dirLoad.snapshot.by_id.get(dir.dir_id)!;
      dir_defs.push(def);
    }
    if (dir_defs.length === 0) {
      // Nothing legal on DC → controlled starter fallback.
      scope_source = "starter_fallback";
      for (const id of [
        "DIR-OPT-ON-TABLE",
        "DIR-STATUS-QUO",
        "DIR-OPT-CONSTRAINTS",
        "DIR-RISK-TOLERANCE",
      ]) {
        const def = dirLoad.snapshot.by_id.get(id);
        if (def) dir_defs.push(def);
      }
    } else {
      scope_source = "catalog";
    }
    const set = new Set<string>();
    for (const d of dir_defs) {
      for (const id of ddrLoad.snapshot.dir_to_ddr.get(d.dir_id) ?? []) {
        set.add(id);
      }
    }
    if (topic.page_07_emit) {
      for (const id of topic.topic_dir_ids) {
        if (dir_defs.some((d) => d.dir_id === id)) set.add("DDR-07-TOPIC-DEPTH");
      }
    }
    // Include proposed legal DDR ids if any.
    const filtered = filterCatalogLegalIds({
      proposed_dir_ids: opts?.proposed_dir_ids,
      proposed_ddr_ids: opts?.proposed_ddr_ids,
      legal_dir_ids: new Set(dirLoad.snapshot.by_id.keys()),
      legal_ddr_ids: new Set(ddrLoad.snapshot.by_id.keys()),
    });
    rejected_ids.push(...filtered.rejected);
    for (const id of filtered.ddr_ids) set.add(id);
    ddr_ids = [...set];
  }

  if (dir_defs.length === 0) {
    throw new Error("ensureDecisionBlueprint: empty_scope_after_catalog");
  }

  const directions = buildDirectionsFromDefinitions(
    dir_defs,
    ddrLoad.snapshot.dir_to_ddr,
    ddrLoad.snapshot.by_id,
  );

  const dc = mergeCatalogDirsIntoDc(dc0, dir_defs, now);

  const blueprint: DecisionBlueprint = {
    blueprint_id: existing?.blueprint_id ?? `bp_${session.session_id}`,
    blueprint_version: existing ? existing.blueprint_version + 1 : 1,
    ddr_version,
    dir_catalog_version,
    session_id: session.session_id,
    context_id: dc.context_id,
    decision_question,
    definition_snapshot: { ...dc.definition },
    directions,
    dir_ids: dir_defs.map((d) => d.dir_id),
    ddr_ids,
    topic_tags: [...topic.topic_tags],
    page_07_emit: topic.page_07_emit,
    scope_source,
    scope_locked: true,
    question_budget: { soft: SOFT, hard: HARD, depth_per_direction: DEPTH },
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  return {
    session: {
      ...session,
      decision_context: dc,
      decision_blueprint: blueprint,
    },
    blueprint,
    created: !existing,
    meta: {
      scope_source,
      topic,
      rejected_ids,
      selected_ddr_ids: ddr_ids,
    },
  };
}
'''

# The early-return block currently sits BEFORE decision_question in the file.
# Replace from first `const decision_question` inside ensureDecisionBlueprint through just before directionIdForDir.
# But the file currently has decision_question then existing early-return then scope...
# Safer: replace entire ensureDecisionBlueprint function.

fn_start = text.find("export function ensureDecisionBlueprint(")
if fn_start < 0:
    raise SystemExit("fn start not found")
fn_end = text.find("\nexport function directionIdForDir(", fn_start)
if fn_end < 0:
    raise SystemExit("fn end not found")

new_fn = r'''export function ensureDecisionBlueprint(
  session: POJUSessionState,
  opts?: {
    now?: string;
    /** Prefer recompute scope from question (first bootstrap). */
    recompute_scope?: boolean;
    proposed_dir_ids?: readonly string[];
    proposed_ddr_ids?: readonly string[];
  },
): {
  session: POJUSessionState;
  blueprint: DecisionBlueprint;
  created: boolean;
  meta: BlueprintInitMeta;
} {
  const dc0 = session.decision_context;
  if (!dc0 || (dc0.status !== "draft" && dc0.status !== "final")) {
    throw new Error("ensureDecisionBlueprint: requires draft|final DC");
  }
  const now = opts?.now ?? new Date().toISOString();
''' + new_body

text = text[:fn_start] + new_fn + text[fn_end:]
p.write_text(text, encoding="utf-8")
print("ensureDecisionBlueprint rewritten", len(text))
