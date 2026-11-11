/**
 * Decision Blueprint — Catalog-validated init from decision question + DC Definition.
 * Blueprint = investigation scope seed (not fact store). Live DIR state lives only on DC.dirs (C3).
 * Priority / DDR↔DIR links come from Phase 2 DDR/DIR Catalogs — never from DIR-id string guessing
 * or DDR_FOR_${dir_id} placeholders.
 */

import type { DecisionContext, DIR } from "@/lib/poju/decision-context/types";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  ACTIVE_DDR_CATALOG_VERSION,
  ACTIVE_DIR_DEFINITION_CATALOG_VERSION,
  loadDdrCatalog,
  loadDirDefinitionCatalog,
  type DdrDefinitionEntry,
  type DdrPriority,
  type DirDefinitionEntry,
} from "@/lib/poju/decision-context/catalog";
import {
  classifyDecisionTopic,
  filterCatalogLegalIds,
  type TopicClassifyResult,
} from "./topic-classify";
import { isDirAnsweredForIntake } from "./intake-answer-coverage";
import type { DecisionBlueprint, InvestigationDirection } from "./types";

const SOFT = 12;
const HARD = 15;
const DEPTH = 3;

const PRIORITY_RANK: Record<DdrPriority, number> = { P0: 0, P1: 1, P2: 2 };

export type BlueprintScopeSource = "catalog" | "starter_fallback";

export type BlueprintInitMeta = {
  scope_source: BlueprintScopeSource;
  topic: TopicClassifyResult;
  rejected_ids: string[];
  selected_ddr_ids: string[];
};

/** Highest (most urgent) DDR priority among a list. */
export function highestDdrPriority(
  priorities: readonly DdrPriority[],
): DdrPriority {
  let best: DdrPriority = "P2";
  for (const p of priorities) {
    if (PRIORITY_RANK[p] < PRIORITY_RANK[best]) best = p;
  }
  return best;
}

/** Formal DDR ids that consume a DIR (Catalog reverse index + optional DDR-07). */
export function catalogDdrIdsForDir(
  dirId: string,
  opts?: {
    dir_to_ddr?: ReadonlyMap<string, readonly string[]>;
    include_ddr07?: boolean;
    topic_dir_ids?: readonly string[];
  },
): string[] {
  const index = opts?.dir_to_ddr;
  const base = index ? [...(index.get(dirId) ?? [])] : [];
  if (
    opts?.include_ddr07 &&
    (opts.topic_dir_ids ?? []).includes(dirId) &&
    !base.includes("DDR-07-TOPIC-DEPTH")
  ) {
    base.push("DDR-07-TOPIC-DEPTH");
  }
  return base;
}

/** Gate class for a DIR from consuming DDR priorities (Catalog), not may_affect_p5 alone. */
export function gateClassForDirFromCatalog(
  dirId: string,
  ddrById: ReadonlyMap<string, DdrDefinitionEntry>,
  dirToDdr: ReadonlyMap<string, readonly string[]>,
): {
  gate_class: DdrPriority;
  ddr_ids: string[];
  decision_critical: boolean;
  may_affect_p5_ranking: boolean;
} {
  const ddr_ids = [...(dirToDdr.get(dirId) ?? [])];
  const prios: DdrPriority[] = [];
  let decision_critical = false;
  let affects_ranking = false;
  for (const id of ddr_ids) {
    const ddr = ddrById.get(id);
    if (!ddr) continue;
    prios.push(ddr.priority);
    if (ddr.decision_critical) decision_critical = true;
    if (ddr.affects_option_ranking) affects_ranking = true;
  }
  const gate_class = prios.length ? highestDdrPriority(prios) : "P2";
  return {
    gate_class,
    ddr_ids,
    decision_critical: decision_critical || gate_class === "P0",
    may_affect_p5_ranking: affects_ranking,
  };
}

function directionMetaForCategory(
  category: DirDefinitionEntry["category"],
): { id: string; label: string; defaultPriority: DdrPriority } {
  switch (category) {
    case "definition":
      return {
        id: "DIRN-DEFINITION",
        label: "Decision definition",
        defaultPriority: "P0",
      };
    case "options":
      return {
        id: "DIRN-OPTIONS",
        label: "Options & status quo",
        defaultPriority: "P0",
      };
    case "constraints":
    case "timing":
      return {
        id: "DIRN-CONSTRAINTS",
        label: "Constraints & timing",
        defaultPriority: "P0",
      };
    case "risk":
    case "validation":
      return {
        id: "DIRN-RISK-EXIT",
        label: "Risk, exit & validation",
        defaultPriority: "P1",
      };
    case "topic":
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
      };
  }
}

function buildDirectionsFromDefinitions(
  dirDefs: DirDefinitionEntry[],
  dirToDdr: ReadonlyMap<string, readonly string[]>,
  ddrById: ReadonlyMap<string, DdrDefinitionEntry>,
): InvestigationDirection[] {
  const map = new Map<string, InvestigationDirection>();
  for (const def of dirDefs) {
    const meta = directionMetaForCategory(def.category);
    const ddr_ids = catalogDdrIdsForDir(def.dir_id, { dir_to_ddr: dirToDdr });
    const gate = gateClassForDirFromCatalog(def.dir_id, ddrById, dirToDdr);
    const priority = highestDdrPriority([
      meta.defaultPriority,
      gate.gate_class,
    ]);
    const prev = map.get(meta.id);
    if (!prev) {
      map.set(meta.id, {
        direction_id: meta.id,
        priority,
        label: meta.label,
        dir_ids: [def.dir_id],
        ddr_ids,
        needed_info: def.need,
        completion_criteria: `DIR ${def.dir_id} reaches known|n_a with required roles satisfied`,
        depth_soft_cap: DEPTH,
        scope_boundary: `Only Catalog DDR/DIR linked to ${meta.id}; no model scope expansion`,
        dependencies: [],
      });
    } else {
      if (!prev.dir_ids.includes(def.dir_id)) prev.dir_ids.push(def.dir_id);
      const prevDdr = prev.ddr_ids ?? (prev.ddr_ids = []);
      for (const d of ddr_ids) {
        if (!prevDdr.includes(d)) prevDdr.push(d);
      }
      prev.needed_info = `${prev.needed_info}; ${def.need}`.slice(0, 500);
      prev.priority = highestDdrPriority([prev.priority, priority]);
    }
  }
  return [...map.values()];
}

/** Seed a live DIR row from Catalog definition (unknown state; never invent known). */
export function seedDirFromDefinition(def: DirDefinitionEntry): DIR {
  return {
    dir_id: def.dir_id,
    need: def.need,
    why: def.why,
    category: def.category,
    serves_face: def.default_serves_face,
    required_fact_roles: [...def.required_fact_roles],
    current_state: "unknown",
    partial_satisfaction: false,
    agenda_item_ids: [],
    id_lifecycle: "active",
    may_affect_p5_ranking: def.may_affect_p5_ranking,
  };
}

export type BuildCatalogBlueprintScopeResult =
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
      scope_source: "catalog";
      ddr_version: string;
      dir_catalog_version: string;
    }
  | {
      ok: false;
      reason_code: string;
      topic: TopicClassifyResult;
      rejected_ids: string[];
    };

/**
 * Resolve formal investigation scope from decision question via Catalog + Topic Applicability.
 * Illegal model/classifier IDs are rejected. Uncertain topic → core DDRs only (no fake packs).
 */
export function buildCatalogBlueprintScope(input: {
  decision_question: string | null | undefined;
  extra_text?: string | null;
  /** Optional model-proposed ids — validated; illegal dropped. */
  proposed_dir_ids?: readonly string[];
  proposed_ddr_ids?: readonly string[];
  include_stakeholders?: boolean;
}): BuildCatalogBlueprintScopeResult {
  const topic = classifyDecisionTopic({
    decision_question: input.decision_question,
    extra_text: input.extra_text,
  });

  const dirLoad = loadDirDefinitionCatalog(ACTIVE_DIR_DEFINITION_CATALOG_VERSION);
  const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);
  if (!dirLoad.ok) {
    return {
      ok: false,
      reason_code: dirLoad.reason_code,
      topic,
      rejected_ids: [],
    };
  }
  if (!ddrLoad.ok) {
    return {
      ok: false,
      reason_code: ddrLoad.reason_code,
      topic,
      rejected_ids: [],
    };
  }

  const legalDirs = new Set(
    [...dirLoad.snapshot.by_id.keys()],
  );
  const legalDdrs = new Set([...ddrLoad.snapshot.by_id.keys()]);

  const filtered = filterCatalogLegalIds({
    proposed_dir_ids: input.proposed_dir_ids,
    proposed_ddr_ids: input.proposed_ddr_ids,
    legal_dir_ids: legalDirs,
    legal_ddr_ids: legalDdrs,
  });

  const selectedDdrs: DdrDefinitionEntry[] = [];
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

  // Blueprint scope = EVERY legal DIR required by EVERY selected DDR (P0, P1, P2)
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
  if (input.include_stakeholders && legalDirs.has("DIR-STAKEHOLDERS")) {
    dirIdSet.add("DIR-STAKEHOLDERS");
  }

  // DC initial seed = P0 DDR required DIRs + topic pack only (scheduling first wave).
  const initialSeedSet = new Set<string>();
  for (const ddr of selectedDdrs) {
    if (ddr.priority !== "P0" && !ddr.topic_gated) continue;
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
      reason_code: "empty_catalog_scope",
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
    scope_source: "catalog",
    ddr_version: ddrLoad.snapshot.ddr_catalog_version,
    dir_catalog_version: dirLoad.snapshot.dir_catalog_version,
  };
}

/** Merge Catalog-seeded DIRs into DC without resetting known/conflict/n_a state (C3). */
export function mergeCatalogDirsIntoDc(
  dc: DecisionContext,
  dirDefs: readonly DirDefinitionEntry[],
  now: string,
): DecisionContext {
  const byId = new Map(dc.dirs.map((d) => [d.dir_id, d]));
  for (const def of dirDefs) {
    const existing = byId.get(def.dir_id);
    if (!existing) {
      byId.set(def.dir_id, seedDirFromDefinition(def));
      continue;
    }
    // Refresh seed fields only; never wipe live state.
    byId.set(def.dir_id, {
      ...existing,
      need: existing.need || def.need,
      why: existing.why || def.why,
      category: existing.category ?? def.category,
      serves_face: existing.serves_face ?? def.default_serves_face,
      required_fact_roles:
        existing.required_fact_roles?.length
          ? existing.required_fact_roles
          : [...def.required_fact_roles],
      may_affect_p5_ranking:
        existing.may_affect_p5_ranking ?? def.may_affect_p5_ranking,
      id_lifecycle:
        existing.id_lifecycle === "deprecated"
          ? "deprecated"
          : existing.id_lifecycle,
    });
  }
  return {
    ...dc,
    dirs: [...byId.values()],
    updated_at: now,
  };
}

function stakeholdersHint(text: string): boolean {
  // Multi-party decision signal — not mere household financial mentions (房贷).
  return /家人一起决定|配偶意见|伴侣不同意|合伙人|联合决策|多方利益相关|团队反对|父母反对/i.test(
    text,
  );
}

/**
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
  if (!bp || !dc0 || (dc0.status !== "draft" && dc0.status !== "final")) {
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
      live.id_lifecycle !== "deprecated" &&
      (live.current_state === "known" ||
        live.current_state === "n_a" ||
        isDirAnsweredForIntake(dc0, live))
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
          d.direction_id === "DIRN-TOPIC" && d.dir_ids.includes(dirId),
      )
    ) {
      band = "P0";
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
  // Guaranteed: seedDirFromDefinition uses current_state "unknown" — never known/n_a.
  return { ...session, decision_context: dc };
}

/**
 * Create or refresh Blueprint from Catalog scope bound to current draft/final DC.
 * Merges DC initial-seed DIRs (P0 + topic) into DC.dirs; full Blueprint scope is
 * retained on decision_blueprint.dir_ids. Deferred P1/P2 activate via
 * activateNextBlueprintPriorityBand during AQE scheduling.
 */
export function ensureDecisionBlueprint(
  session: POJUSessionState,
  opts?: {
    now?: string;
    /** Prefer recompute scope from question (first bootstrap). */
    recompute_scope?: boolean;
    proposed_dir_ids?: readonly string[];
    proposed_ddr_ids?: readonly string[];
    /**
     * Confirmed new decision target (goal change). Scope is recomputed from
     * this target alone; earlier opening text must not leak old topics in.
     */
    goal_target?: string;
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
  const goalTarget = opts?.goal_target?.trim() || null;
  const decision_question =
    goalTarget ??
    dc0.definition.decision_question ??
    session.original_question ??
    session.agent_v2?.original_question ??
    null;
  const extra = goalTarget
    ? goalTarget
    : [
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
    !opts?.recompute_scope &&
    !goalTarget
  ) {
    const missing = dc0.dirs
      .filter(
        (d) =>
          d.id_lifecycle !== "deprecated" &&
          !existing.dir_ids.includes(d.dir_id),
      )
      .map((d) => d.dir_id);
    if (missing.length === 0) {
      const activated = activateNextBlueprintPriorityBand(session, now);
      return {
        session: activated,
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
    Boolean(opts?.recompute_scope) || Boolean(goalTarget) || activeOnDc.length === 0;

  let scope_source: BlueprintScopeSource = "catalog";
  let dir_defs: DirDefinitionEntry[] = [];
  let ddr_ids: string[] = [];
  let rejected_ids: string[] = [];
  let ddr_version: string = ddrLoad.snapshot.ddr_catalog_version;
  let dir_catalog_version: string = dirLoad.snapshot.dir_catalog_version;
  /** First-wave DC seed; defaults to full dir_defs until Catalog scope sets subset. */
  let initial_seed_dir_ids: string[] = [];

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
      ddr_version = scope.ddr_version as typeof ddr_version;
      dir_catalog_version = scope.dir_catalog_version as typeof dir_catalog_version;
      scope_source = "catalog";
      initial_seed_dir_ids = [...scope.initial_seed_dir_ids];
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

  // If Catalog path did not set a seed subset (fallback / DC-validate paths),
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
}

export function directionIdForDir(
  blueprint: DecisionBlueprint,
  dirId: string,
): string {
  const hit = blueprint.directions.find((d) => d.dir_ids.includes(dirId));
  return hit?.direction_id ?? "DIRN-TOPIC";
}

export function blueprintAllowsDir(
  blueprint: DecisionBlueprint,
  dirId: string,
): boolean {
  return blueprint.dir_ids.includes(dirId);
}

export function blueprintAllowsDdr(
  blueprint: DecisionBlueprint,
  ddrId: string,
): boolean {
  if (blueprint.ddr_ids?.includes(ddrId)) return true;
  return blueprint.directions.some((d) => d.ddr_ids?.includes(ddrId));
}

/** Resolve real Catalog DDR ids for a DIR within current Blueprint scope. */
export function resolveDdrIdsForDir(
  dirId: string,
  blueprint?: DecisionBlueprint | null,
): string[] {
  const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);
  if (!ddrLoad.ok) return [];
  let ids = [...(ddrLoad.snapshot.dir_to_ddr.get(dirId) ?? [])];
  if (blueprint?.page_07_emit) {
    const topicDirs = blueprint.directions.find((d) => d.direction_id === "DIRN-TOPIC")
      ?.dir_ids ?? [];
    if (topicDirs.includes(dirId) && !ids.includes("DDR-07-TOPIC-DEPTH")) {
      ids.push("DDR-07-TOPIC-DEPTH");
    }
  }
  if (blueprint?.ddr_ids?.length) {
    ids = ids.filter(
      (id) =>
        blueprint.ddr_ids!.includes(id) ||
        blueprint.directions.some((d) => d.ddr_ids?.includes(id)),
    );
  }
  // Never emit placeholder DDR_FOR_*.
  return ids.filter((id) => !id.startsWith("DDR_FOR_"));
}
