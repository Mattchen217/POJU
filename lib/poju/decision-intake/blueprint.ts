/**
 * M1 Decision Blueprint — minimal production init from live DC.dirs + Definition.
 * Reuses formal DIR seed fields; does not invent a parallel goal system.
 * Blueprint never holds live current_state (C3).
 */

import type { DecisionContext, DIR } from "@/lib/poju/decision-context/types";
import type { POJUSessionState } from "@/lib/poju/types";
import type { DecisionBlueprint, InvestigationDirection } from "./types";

const SOFT = 12;
const HARD = 15;
const DEPTH = 3;

function directionForDir(dir: DIR): { id: string; priority: "P0" | "P1" | "P2"; label: string } {
  const id = dir.dir_id;
  if (id.includes("DEF") || id.includes("OPT") || id.includes("STATUS") || id.includes("CONSTRAINT") || id.includes("IRREV") || id.includes("TIMING") || id.includes("PAST")) {
    return {
      id: id.includes("OPT") || id.includes("STATUS") || id.includes("PAST")
        ? "DIRN-OPTIONS"
        : id.includes("CONSTRAINT") || id.includes("IRREV") || id.includes("TIMING")
          ? "DIRN-CONSTRAINTS"
          : "DIRN-DEFINITION",
      priority: "P0",
      label:
        id.includes("OPT") || id.includes("STATUS") || id.includes("PAST")
          ? "Options & status quo"
          : id.includes("CONSTRAINT") || id.includes("IRREV") || id.includes("TIMING")
            ? "Constraints & timing"
            : "Decision definition",
    };
  }
  if (id.includes("RISK") || id.includes("EXIT") || id.includes("VALIDATION")) {
    return { id: "DIRN-RISK-EXIT", priority: "P1", label: "Risk, exit & validation" };
  }
  return { id: "DIRN-TOPIC", priority: "P1", label: "Topic-specific investigation" };
}

function buildDirections(dirs: DIR[]): InvestigationDirection[] {
  const map = new Map<string, InvestigationDirection>();
  for (const dir of dirs) {
    if (dir.id_lifecycle === "deprecated") continue;
    const meta = directionForDir(dir);
    const prev = map.get(meta.id);
    if (!prev) {
      map.set(meta.id, {
        direction_id: meta.id,
        priority: meta.priority,
        label: meta.label,
        dir_ids: [dir.dir_id],
        needed_info: dir.need,
        completion_criteria: `DIR ${dir.dir_id} reaches known|n_a with required roles satisfied`,
        depth_soft_cap: DEPTH,
        scope_boundary: `Only DDR/DIR linked to ${meta.id}; no model scope expansion`,
      });
    } else {
      prev.dir_ids.push(dir.dir_id);
      prev.needed_info = `${prev.needed_info}; ${dir.need}`.slice(0, 500);
    }
  }
  return [...map.values()];
}

/** Create or return existing Blueprint bound to current draft/final DC. */
export function ensureDecisionBlueprint(
  session: POJUSessionState,
  opts?: { now?: string },
): { session: POJUSessionState; blueprint: DecisionBlueprint; created: boolean } {
  const dc = session.decision_context;
  if (!dc || (dc.status !== "draft" && dc.status !== "final")) {
    throw new Error("ensureDecisionBlueprint: requires draft|final DC");
  }
  const now = opts?.now ?? new Date().toISOString();
  const existing = session.decision_blueprint;
  if (
    existing &&
    existing.context_id === dc.context_id &&
    existing.session_id === session.session_id &&
    existing.dir_ids.length > 0
  ) {
    // Merge any newly seeded DIRs without resetting.
    const missing = dc.dirs
      .filter((d) => d.id_lifecycle !== "deprecated" && !existing.dir_ids.includes(d.dir_id))
      .map((d) => d.dir_id);
    if (missing.length === 0) {
      return { session, blueprint: existing, created: false };
    }
    const directions = buildDirections(dc.dirs);
    const next: DecisionBlueprint = {
      ...existing,
      dir_ids: [...new Set([...existing.dir_ids, ...missing])],
      directions,
      definition_snapshot: dc.definition,
      decision_question: dc.definition.decision_question,
      updated_at: now,
      blueprint_version: existing.blueprint_version + 1,
    };
    return {
      session: { ...session, decision_blueprint: next },
      blueprint: next,
      created: false,
    };
  }

  const directions = buildDirections(dc.dirs);
  const blueprint: DecisionBlueprint = {
    blueprint_id: `bp_${session.session_id}`,
    blueprint_version: 1,
    ddr_version: "1.1",
    dir_catalog_version: "1",
    session_id: session.session_id,
    context_id: dc.context_id,
    decision_question:
      dc.definition.decision_question ??
      session.original_question ??
      session.agent_v2?.original_question ??
      null,
    definition_snapshot: { ...dc.definition },
    directions,
    dir_ids: dc.dirs.filter((d) => d.id_lifecycle !== "deprecated").map((d) => d.dir_id),
    scope_locked: true,
    question_budget: { soft: SOFT, hard: HARD, depth_per_direction: DEPTH },
    created_at: now,
    updated_at: now,
  };
  return {
    session: { ...session, decision_blueprint: blueprint },
    blueprint,
    created: true,
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
