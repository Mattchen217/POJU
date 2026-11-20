# -*- coding: utf-8 -*-
"""M2.3-R1: preserve full DDR investigation scope in Blueprint."""
from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")

# ---------- types.ts: add initial_seed_dir_ids ----------
types_path = ROOT / "lib/poju/decision-intake/types.ts"
types = types_path.read_text(encoding="utf-8")
old = """  /** catalog = question-specific Catalog scope; starter_fallback = controlled fallback only. */
  scope_source?: \"catalog\" | \"starter_fallback\";
  scope_locked: boolean;"""
new = """  /** catalog = question-specific Catalog scope; starter_fallback = controlled fallback only. */
  scope_source?: \"catalog\" | \"starter_fallback\";
  /**
   * First-wave DC seed DIRs (P0 DDR required + topic pack).
   * Distinct from dir_ids (complete Blueprint scope) and from AQE scheduling.
   */
  initial_seed_dir_ids?: string[];
  scope_locked: boolean;"""
if old not in types:
    raise SystemExit("types.ts anchor not found")
types_path.write_text(types.replace(old, new, 1), encoding="utf-8")
print("types.ts OK")

# ---------- blueprint.ts ----------
bp_path = ROOT / "lib/poju/decision-intake/blueprint.ts"
bp = bp_path.read_text(encoding="utf-8")

# 1) Expand BuildCatalogBlueprintScopeResult
old_res = """export type BuildCatalogBlueprintScopeResult =
  | {
      ok: true;
      dir_ids: string[];
      ddr_ids: string[];
      dir_defs: DirDefinitionEntry[];
      topic: TopicClassifyResult;
      rejected_ids: string[];
      scope_source: \"catalog\";
      ddr_version: string;
      dir_catalog_version: string;
    }"""
new_res = """export type BuildCatalogBlueprintScopeResult =
  | {
      ok: true;
      /** Complete formal investigation scope (P0+P1+P2 required DIRs). */
      dir_ids: string[];
      ddr_ids: string[];
      dir_defs: DirDefinitionEntry[];
      /** First-wave DC seed only (P0 DDR required + topic pack). */
      initial_seed_dir_ids: string[];
      topic: TopicClassifyResult;
      rejected_ids: string[];
      scope_source: \"catalog\";
      ddr_version: string;
      dir_catalog_version: string;
    }"""
if old_res not in bp:
    raise SystemExit("BuildCatalogBlueprintScopeResult anchor not found")
bp = bp.replace(old_res, new_res, 1)

# 2) Replace the scope building block that drops P1/P2
old_scope_block = """  // Initial askable DC seed = P0 DDR required DIRs + topic pack DIRs.
  // P1/P2-only DIRs remain on Blueprint.ddr_ids for report obligations but are
  // not forced into the first investigation wave (Adaptive Engine prioritizes P0).
  const dirIdSet = new Set<string>();
  for (const ddr of selectedDdrs) {
    if (ddr.priority !== \"P0\" && !ddr.topic_gated) continue;
    for (const id of ddr.required_dir_ids) {
      if (legalDirs.has(id)) dirIdSet.add(id);
    }
  }
  for (const id of topic.topic_dir_ids) {
    if (legalDirs.has(id)) dirIdSet.add(id);
  }
  for (const id of filtered.dir_ids) dirIdSet.add(id);

  // Stakeholders only when multi-party signal (caller) and Catalog-legal.
  if (input.include_stakeholders && legalDirs.has(\"DIR-STAKEHOLDERS\")) {
    dirIdSet.add(\"DIR-STAKEHOLDERS\");
  }

  // Never seed DIR-DEF-QUESTION as an askable gap if definition already has the question —
  // still include it in scope (required by DDRs); live state may be set by caller.

  const dir_defs: DirDefinitionEntry[] = [];
  for (const id of dirIdSet) {
    const def = dirLoad.snapshot.by_id.get(id);
    if (def) dir_defs.push(def);
  }

  if (dir_defs.length === 0) {
    return {
      ok: false,
      reason_code: \"empty_catalog_scope\",
      topic,
      rejected_ids: filtered.rejected,
    };
  }

  return {
    ok: true,
    dir_ids: dir_defs.map((d) => d.dir_id),
    ddr_ids: selectedDdrs.map((d) => d.ddr_id),
    dir_defs,
    topic,
    rejected_ids: filtered.rejected,
    scope_source: \"catalog\",
    ddr_version: ddrLoad.snapshot.ddr_catalog_version,
    dir_catalog_version: dirLoad.snapshot.dir_catalog_version,
  };
}"""

new_scope_block = """  // Blueprint scope = EVERY legal DIR required by EVERY selected DDR (P0, P1, P2)
  // plus topic pack. Do NOT drop P1/P2 from formal scope merely because scheduling
  // defers them. DC initial seed remains a subset (P0 + topic); AQE activates later.
  const dirIdSet = new Set<string>();
  for (const ddr of selectedDdrs) {
    for (const id of ddr.required_dir_ids) {
      if (legalDirs.has(id)) dirIdSet.add(id);
    }
  }
  for (const id of topic.topic_dir_ids) {
    if (legalDirs.has(id)) dirIdSet.add(id);
  }
  for (const id of filtered.dir_ids) dirIdSet.add(id);

  // Stakeholders only when multi-party signal (caller) and Catalog-legal.
  if (input.include_stakeholders && legalDirs.has(\"DIR-STAKEHOLDERS\")) {
    dirIdSet.add(\"DIR-STAKEHOLDERS\");
  }

  // DC initial seed = P0 DDR required DIRs + topic pack only (scheduling first wave).
  const initialSeedSet = new Set<string>();
  for (const ddr of selectedDdrs) {
    if (ddr.priority !== \"P0\" && !ddr.topic_gated) continue;
    for (const id of ddr.required_dir_ids) {
      if (legalDirs.has(id) && dirIdSet.has(id)) initialSeedSet.add(id);
    }
  }
  for (const id of topic.topic_dir_ids) {
    if (legalDirs.has(id) && dirIdSet.has(id)) initialSeedSet.add(id);
  }

  const dir_defs: DirDefinitionEntry[] = [];
  for (const id of dirIdSet) {
    const def = dirLoad.snapshot.by_id.get(id);
    if (def) dir_defs.push(def);
  }

  if (dir_defs.length === 0) {
    return {
      ok: false,
      reason_code: \"empty_catalog_scope\",
      topic,
      rejected_ids: filtered.rejected,
    };
  }

  const initial_seed_dir_ids = [...initialSeedSet].filter((id) =>
    dir_defs.some((d) => d.dir_id === id),
  );

  return {
    ok: true,
    dir_ids: dir_defs.map((d) => d.dir_id),
    ddr_ids: selectedDdrs.map((d) => d.ddr_id),
    dir_defs,
    initial_seed_dir_ids,
    topic,
    rejected_ids: filtered.rejected,
    scope_source: \"catalog\",
    ddr_version: ddrLoad.snapshot.ddr_catalog_version,
    dir_catalog_version: dirLoad.snapshot.dir_catalog_version,
  };
}"""

if old_scope_block not in bp:
    # Try with different dash characters
    raise SystemExit("scope block anchor not found — check encoding")
bp = bp.replace(old_scope_block, new_scope_block, 1)

# 3) Insert activateNextBlueprintPriorityBand before ensureDecisionBlueprint
marker = """/**
 * Create or refresh Blueprint from Catalog scope bound to current draft/final DC.
 * Also merges Catalog DIR seeds into DC.dirs when missing (preserves live state).
 */
export function ensureDecisionBlueprint("""

activate_fn = """/**
 * AQE scheduling helper: keep P0-first, but after a priority band has no unfinished
 * Blueprint DIRs, activate the next band (P1 then P2) onto DC as unknown.
 * Never marks DIRs known or n_a. Blueprint scope remains the authority for which
 * DIRs may be activated.
 */
export function activateNextBlueprintPriorityBand(
  session: POJUSessionState,
  now?: string,
): POJUSessionState {
  const bp = session.decision_blueprint;
  const dc0 = session.decision_context;
  if (!bp || !dc0 || (dc0.status !== \"draft\" && dc0.status !== \"final\")) {
    return session;
  }
  const ts = now ?? new Date().toISOString();
  const dirLoad = loadDirDefinitionCatalog(ACTIVE_DIR_DEFINITION_CATALOG_VERSION);
  const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);
  if (!dirLoad.ok || !ddrLoad.ok) return session;

  const unfinished: Record<DdrPriority, string[]> = { P0: [], P1: [], P2: [] };
  for (const dirId of bp.dir_ids) {
    const live = dc0.dirs.find((d) => d.dir_id === dirId);
    if (
      live &&
      live.id_lifecycle !== \"deprecated\" &&
      (live.current_state === \"known\" || live.current_state === \"n_a\")
    ) {
      continue;
    }
    const gate = gateClassForDirFromCatalog(
      dirId,
      ddrLoad.snapshot.by_id,
      ddrLoad.snapshot.dir_to_ddr,
    );
    let band: DdrPriority = gate.gate_class;
    // Match production-intake-ask: topic pack DIRs are first-wave critical when emitted.
    if (
      bp.page_07_emit &&
      bp.directions.some(
        (d) =>
          d.direction_id === \"DIRN-TOPIC\" && d.dir_ids.includes(dirId),
      )
    ) {
      band = \"P0\";
    }
    unfinished[band].push(dirId);
  }

  let toActivate: string[] = [];
  if (unfinished.P0.length > 0) toActivate = unfinished.P0;
  else if (unfinished.P1.length > 0) toActivate = unfinished.P1;
  else if (unfinished.P2.length > 0) toActivate = unfinished.P2;
  else return session;

  const missingDefs: DirDefinitionEntry[] = [];
  for (const id of toActivate) {
    if (dc0.dirs.some((d) => d.dir_id === id)) continue;
    const def = dirLoad.snapshot.by_id.get(id);
    if (def) missingDefs.push(def);
  }
  if (missingDefs.length === 0) return session;

  const dc = mergeCatalogDirsIntoDc(dc0, missingDefs, ts);
  // Guaranteed: seedDirFromDefinition uses current_state \"unknown\" — never known/n_a.
  return { ...session, decision_context: dc };
}

/**
 * Create or refresh Blueprint from Catalog scope bound to current draft/final DC.
 * Merges DC initial-seed DIRs (P0 + topic) into DC.dirs; full Blueprint scope is
 * retained on decision_blueprint.dir_ids. Deferred P1/P2 activate via
 * activateNextBlueprintPriorityBand during AQE scheduling.
 */
export function ensureDecisionBlueprint("""

if marker not in bp:
    raise SystemExit("ensureDecisionBlueprint marker not found")
bp = bp.replace(marker, activate_fn, 1)

# 4) Fix early-return path to run activation
old_early = """    if (missing.length === 0) {
      return {
        session,
        blueprint: existing,
        created: false,
        meta: {
          scope_source: existing.scope_source ?? \"catalog\",
          topic: {
            topic_tags: (existing.topic_tags as TopicClassifyResult[\"topic_tags\"]) ?? [
              \"strategic_choice\",
            ],
            page_07_emit: existing.page_07_emit ?? false,
            topic_dir_ids: [],
            confidence: \"high\",
            classifier: \"deterministic_m23_v1\",
            notes: [\"existing_blueprint\"],
            used_uncertain_fallback: false,
          },
          rejected_ids: [],
          selected_ddr_ids: existing.ddr_ids ?? [],
        },
      };
    }
  }"""

new_early = """    if (missing.length === 0) {
      const activated = activateNextBlueprintPriorityBand(session, now);
      return {
        session: activated,
        blueprint: existing,
        created: false,
        meta: {
          scope_source: existing.scope_source ?? \"catalog\",
          topic: {
            topic_tags: (existing.topic_tags as TopicClassifyResult[\"topic_tags\"]) ?? [
              \"strategic_choice\",
            ],
            page_07_emit: existing.page_07_emit ?? false,
            topic_dir_ids: [],
            confidence: \"high\",
            classifier: \"deterministic_m23_v1\",
            notes: [\"existing_blueprint\"],
            used_uncertain_fallback: false,
          },
          rejected_ids: [],
          selected_ddr_ids: existing.ddr_ids ?? [],
        },
      };
    }
  }"""

if old_early not in bp:
    raise SystemExit("early return anchor not found")
bp = bp.replace(old_early, new_early, 1)

# 5) After successful catalog scope, track initial_seed and only merge seed into DC
# Find the block that assigns from scope.ok and later mergeCatalogDirsIntoDc

old_ok = """    if (scope.ok) {
      dir_defs = scope.dir_defs;
      ddr_ids = scope.ddr_ids;
      rejected_ids = scope.rejected_ids;
      ddr_version = scope.ddr_version as typeof ddr_version;
      dir_catalog_version = scope.dir_catalog_version as typeof dir_catalog_version;
      scope_source = \"catalog\";
    } else {"""

new_ok = """    let initial_seed_dir_ids: string[] = [];
    if (scope.ok) {
      dir_defs = scope.dir_defs;
      ddr_ids = scope.ddr_ids;
      rejected_ids = scope.rejected_ids;
      ddr_version = scope.ddr_version as typeof ddr_version;
      dir_catalog_version = scope.dir_catalog_version as typeof dir_catalog_version;
      scope_source = \"catalog\";
      initial_seed_dir_ids = [...scope.initial_seed_dir_ids];
    } else {"""

if old_ok not in bp:
    raise SystemExit("scope.ok assign anchor not found")
bp = bp.replace(old_ok, new_ok, 1)

# Problem: initial_seed_dir_ids is declared inside `if (useFullCatalogScope)` block.
# Need a variable outside. Let me fix by declaring before the if.

# Revert the nested let and declare earlier
bp = bp.replace(
    """    let initial_seed_dir_ids: string[] = [];
    if (scope.ok) {""",
    """    if (scope.ok) {""",
    1,
)

old_vars = """  let scope_source: BlueprintScopeSource = \"catalog\";
  let dir_defs: DirDefinitionEntry[] = [];
  let ddr_ids: string[] = [];
  let rejected_ids: string[] = [];
  let ddr_version: string = ddrLoad.snapshot.ddr_catalog_version;
  let dir_catalog_version: string = dirLoad.snapshot.dir_catalog_version;

  if (useFullCatalogScope) {"""

new_vars = """  let scope_source: BlueprintScopeSource = \"catalog\";
  let dir_defs: DirDefinitionEntry[] = [];
  let ddr_ids: string[] = [];
  let rejected_ids: string[] = [];
  let ddr_version: string = ddrLoad.snapshot.ddr_catalog_version;
  let dir_catalog_version: string = dirLoad.snapshot.dir_catalog_version;
  /** First-wave DC seed; defaults to full dir_defs until Catalog scope sets subset. */
  let initial_seed_dir_ids: string[] = [];

  if (useFullCatalogScope) {"""

if old_vars not in bp:
    raise SystemExit("vars anchor not found")
bp = bp.replace(old_vars, new_vars, 1)

# Re-add assignment inside scope.ok
bp = bp.replace(
    """      scope_source = \"catalog\";
    } else {
      scope_source = \"starter_fallback\";""",
    """      scope_source = \"catalog\";
      initial_seed_dir_ids = [...scope.initial_seed_dir_ids];
    } else {
      scope_source = \"starter_fallback\";""",
    1,
)

# After fallback dir_defs built in else of scope.ok, set initial_seed = all fallback
# And after the non-useFullCatalogScope branch, set initial_seed = all dir_defs if empty

# Replace merge + blueprint construction
old_merge = """  const directions = buildDirectionsFromDefinitions(
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
}"""

new_merge = """  // If Catalog path did not set a seed subset (fallback / DC-validate paths),
  // first-wave seed equals the formal scope for that path.
  if (initial_seed_dir_ids.length === 0) {
    initial_seed_dir_ids = dir_defs.map((d) => d.dir_id);
  }

  const directions = buildDirectionsFromDefinitions(
    dir_defs,
    ddrLoad.snapshot.dir_to_ddr,
    ddrLoad.snapshot.by_id,
  );

  // DC initial seed = first-wave only (P0 + topic). Full scope stays on Blueprint.
  const seedDefs = dir_defs.filter((d) =>
    initial_seed_dir_ids.includes(d.dir_id),
  );
  let dc = mergeCatalogDirsIntoDc(dc0, seedDefs, now);

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
    initial_seed_dir_ids: [...initial_seed_dir_ids],
    scope_locked: true,
    question_budget: { soft: SOFT, hard: HARD, depth_per_direction: DEPTH },
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  let nextSession: POJUSessionState = {
    ...session,
    decision_context: dc,
    decision_blueprint: blueprint,
  };
  // Activate current scheduling band (no-op while P0 unfinished; pulls P1/P2 later).
  nextSession = activateNextBlueprintPriorityBand(nextSession, now);

  return {
    session: nextSession,
    blueprint: nextSession.decision_blueprint!,
    created: !existing,
    meta: {
      scope_source,
      topic,
      rejected_ids,
      selected_ddr_ids: ddr_ids,
    },
  };
}"""

if old_merge not in bp:
    raise SystemExit("merge/blueprint construct anchor not found")
bp = bp.replace(old_merge, new_merge, 1)

bp_path.write_text(bp, encoding="utf-8")
print("blueprint.ts OK")

# ---------- index.ts export ----------
idx_path = ROOT / "lib/poju/decision-intake/index.ts"
idx = idx_path.read_text(encoding="utf-8")
old_exp = """export {
  ensureDecisionBlueprint,
  directionIdForDir,
  blueprintAllowsDir,
  blueprintAllowsDdr,
  buildCatalogBlueprintScope,
  resolveDdrIdsForDir,
  gateClassForDirFromCatalog,
  mergeCatalogDirsIntoDc,
  seedDirFromDefinition,
} from \"./blueprint\";"""
new_exp = """export {
  ensureDecisionBlueprint,
  activateNextBlueprintPriorityBand,
  directionIdForDir,
  blueprintAllowsDir,
  blueprintAllowsDdr,
  buildCatalogBlueprintScope,
  resolveDdrIdsForDir,
  gateClassForDirFromCatalog,
  mergeCatalogDirsIntoDc,
  seedDirFromDefinition,
} from \"./blueprint\";"""
if old_exp not in idx:
    raise SystemExit("index export anchor not found")
idx_path.write_text(idx.replace(old_exp, new_exp, 1), encoding="utf-8")
print("index.ts OK")

# ---------- adaptive-turn.ts: activate before planning candidates ----------
at_path = ROOT / "lib/poju/decision-intake/adaptive-turn.ts"
at = at_path.read_text(encoding="utf-8")

# Find imports from blueprint / decision-intake
if "activateNextBlueprintPriorityBand" not in at:
    # Check how ensureDecisionBlueprint is imported
    import re
    m = re.search(r'import \{([^}]+)\} from ["\']\./blueprint["\']', at)
    if m:
        old_imp = m.group(0)
        if "activateNextBlueprintPriorityBand" not in old_imp:
            new_imp = old_imp.replace(
                "ensureDecisionBlueprint",
                "ensureDecisionBlueprint,\n  activateNextBlueprintPriorityBand",
            )
            at = at.replace(old_imp, new_imp, 1)
    else:
        # Maybe imported from index or local relative differently
        m2 = re.search(r'ensureDecisionBlueprint', at)
        print("ensureDecisionBlueprint found at", m2.start() if m2 else None)
        # Add import near top after other local imports
        add = 'import { activateNextBlueprintPriorityBand } from "./blueprint";\n'
        # find first import from ./
        m3 = re.search(r'^import .+ from "\./', at, re.M)
        if m3:
            at = at[:m3.start()] + add + at[m3.start():]
        else:
            raise SystemExit("cannot find import insertion point in adaptive-turn")

old_plan = """async function planFromState(
  session: POJUSessionState,
  understanding: UnderstandingState,
  now: string,
): Promise<{
  session: POJUSessionState;
  understanding: UnderstandingState;
  plan: AdaptiveQuestionPlan | null;
  authorized_question: string | null;
}> {
  const dc = session.decision_context!;
  const blueprint = session.decision_blueprint!;
  let budget = understanding.budget;"""

new_plan = """async function planFromState(
  session: POJUSessionState,
  understanding: UnderstandingState,
  now: string,
): Promise<{
  session: POJUSessionState;
  understanding: UnderstandingState;
  plan: AdaptiveQuestionPlan | null;
  authorized_question: string | null;
}> {
  // After P0 finishes, pull unfinished P1 (then P2) from Blueprint onto DC.
  session = activateNextBlueprintPriorityBand(session, now);
  const dc = session.decision_context!;
  const blueprint = session.decision_blueprint!;
  let budget = understanding.budget;"""

if old_plan not in at:
    raise SystemExit("planFromState anchor not found")
at = at.replace(old_plan, new_plan, 1)
at_path.write_text(at, encoding="utf-8")
print("adaptive-turn.ts OK")

print("ALL PATCHES APPLIED")
