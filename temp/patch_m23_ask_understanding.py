from pathlib import Path

# --- understanding-state.ts ---
p = Path(r"lib/poju/decision-intake/understanding-state.ts")
text = p.read_text(encoding="utf-8")
text = text.replace(
    'import { directionIdForDir } from "./blueprint";',
    'import {\n  directionIdForDir,\n  gateClassForDirFromCatalog,\n  resolveDdrIdsForDir,\n} from "./blueprint";\nimport {\n  ACTIVE_DDR_CATALOG_VERSION,\n  loadDdrCatalog,\n} from "@/lib/poju/decision-context/catalog";',
)
old = '''    const direction_id = directionIdForDir(input.blueprint, dir.dir_id);
    const direction = input.blueprint.directions.find(
      (d) => d.direction_id === direction_id,
    );
    const priority = direction?.priority ?? (dir.may_affect_p5_ranking ? "P0" : "P1");
    let gap_type: "unknown" | "partial" | "conflict" | "declined" = "unknown";
    if (dir.current_state === "conflict") gap_type = "conflict";
    else if (
      relatedFacts.length > 0 &&
      relatedFacts.every((f) => f.status === "declined")
    ) {
      gap_type = "declined";
    } else if (dir.partial_satisfaction || relatedFacts.length > 0) {
      gap_type = "partial";
    }
    needs.push({
      kind: "dir_based",
      dir_id: dir.dir_id,
      ddr_ids: [`DDR_FOR_${dir.dir_id}`],
      direction_id,
      priority,
      why: dir.why || "Required for decision judgment",
      missing_content: dir.need,
      may_affect_p5_ranking: dir.may_affect_p5_ranking !== false,
      gap_type,
      must_continue: dir.may_affect_p5_ranking !== false,
    });'''
new = '''    // Blueprint scope only — never invent needs outside Catalog seed.
    if (!input.blueprint.dir_ids.includes(dir.dir_id)) continue;
    const direction_id = directionIdForDir(input.blueprint, dir.dir_id);
    const direction = input.blueprint.directions.find(
      (d) => d.direction_id === direction_id,
    );
    const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);
    const gate = ddrLoad.ok
      ? gateClassForDirFromCatalog(
          dir.dir_id,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        )
      : null;
    const ddr_ids = resolveDdrIdsForDir(dir.dir_id, input.blueprint);
    if (ddr_ids.length === 0) {
      // No legal Catalog DDR link — do not disguise as formal DDR investigation need.
      continue;
    }
    const priority =
      gate?.gate_class ??
      direction?.priority ??
      "P2";
    let gap_type: "unknown" | "partial" | "conflict" | "declined" = "unknown";
    if (dir.current_state === "conflict") gap_type = "conflict";
    else if (
      relatedFacts.length > 0 &&
      relatedFacts.every((f) => f.status === "declined")
    ) {
      gap_type = "declined";
    } else if (dir.partial_satisfaction || relatedFacts.length > 0) {
      gap_type = "partial";
    }
    const ranking =
      gate?.may_affect_p5_ranking ?? dir.may_affect_p5_ranking !== false;
    needs.push({
      kind: "dir_based",
      dir_id: dir.dir_id,
      ddr_ids,
      direction_id,
      priority,
      why: dir.why || "Required for decision judgment",
      missing_content: dir.need,
      may_affect_p5_ranking: ranking,
      gap_type,
      must_continue: ranking || priority === "P0",
    });'''
if old not in text:
    raise SystemExit('understanding-state needs block not found')
p.write_text(text.replace(old, new), encoding='utf-8')
print('understanding-state patched')

# --- production-intake-ask.ts ---
p2 = Path(r"lib/poju/decision-context/production-intake-ask.ts")
t2 = p2.read_text(encoding="utf-8")
if 'resolveDdrIdsForDir' not in t2:
    t2 = t2.replace(
        'import type { DecisionContext } from "./types";',
        'import type { DecisionContext } from "./types";\nimport type { DecisionBlueprint } from "@/lib/poju/decision-intake/types";\nimport {\n  gateClassForDirFromCatalog,\n  resolveDdrIdsForDir,\n} from "@/lib/poju/decision-intake/blueprint";\nimport {\n  ACTIVE_DDR_CATALOG_VERSION,\n  loadDdrCatalog,\n} from "@/lib/poju/decision-context/catalog";',
    )
old2 = '''/** Build dir_based gap candidates from live DC dirs (unknown/conflict). */
export function buildIntakeCandidatesFromDc(
  dc: DecisionContext,
): RankablePlanningCandidate[] {
  const out: RankablePlanningCandidate[] = [];
  for (const dir of dc.dirs) {
    if (dir.id_lifecycle === "deprecated") continue;
    if (dir.current_state === "known" || dir.current_state === "n_a") continue;
    const roles = dir.required_fact_roles ?? [];
    if (roles.length === 0) continue;
    const fact_role_codes = roles.map(
      (r) => `v1/dir/${dir.dir_id}/role/${r}`,
    );
    const gate =
      dir.may_affect_p5_ranking === true ? ("P0" as const) : ("P1" as const);
    out.push({
      candidate_id: `cq_dir_${dir.dir_id}`,
      kind: "dir_based",
      dir_ids: [dir.dir_id],
      ddr_ids: [`DDR_FOR_${dir.dir_id}`],
      fact_role_codes,
      impact: {
        decision_critical: dir.may_affect_p5_ranking === true,
        may_affect_p5_ranking: dir.may_affect_p5_ranking === true,
        gate_class: gate,
      },
      depth: 1,
      repetition_count: 0,
      budget_cost: 1,
    });
  }
  return out;
}'''
new2 = '''/** Build dir_based gap candidates from live DC dirs (unknown/conflict). */
export function buildIntakeCandidatesFromDc(
  dc: DecisionContext,
  blueprint?: DecisionBlueprint | null,
): RankablePlanningCandidate[] {
  const out: RankablePlanningCandidate[] = [];
  const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);
  for (const dir of dc.dirs) {
    if (dir.id_lifecycle === "deprecated") continue;
    if (dir.current_state === "known" || dir.current_state === "n_a") continue;
    if (blueprint && !blueprint.dir_ids.includes(dir.dir_id)) continue;
    const roles = dir.required_fact_roles ?? [];
    if (roles.length === 0) continue;
    const ddr_ids = resolveDdrIdsForDir(dir.dir_id, blueprint);
    // No legal Catalog DDR link → not a formal DDR investigation candidate.
    if (ddr_ids.length === 0) continue;
    if (ddr_ids.some((id) => id.startsWith("DDR_FOR_"))) continue;
    const fact_role_codes = roles.map(
      (r) => `v1/dir/${dir.dir_id}/role/${r}`,
    );
    const gateInfo = ddrLoad.ok
      ? gateClassForDirFromCatalog(
          dir.dir_id,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        )
      : null;
    const gate = gateInfo?.gate_class ?? "P2";
    const may_affect_p5_ranking =
      gateInfo?.may_affect_p5_ranking ?? dir.may_affect_p5_ranking === true;
    const decision_critical =
      gateInfo?.decision_critical ?? may_affect_p5_ranking;
    out.push({
      candidate_id: `cq_dir_${dir.dir_id}`,
      kind: "dir_based",
      dir_ids: [dir.dir_id],
      ddr_ids,
      fact_role_codes,
      impact: {
        decision_critical,
        may_affect_p5_ranking,
        gate_class: gate,
      },
      depth: 1,
      repetition_count: 0,
      budget_cost: 1,
    });
  }
  return out;
}'''
if old2 not in t2:
    raise SystemExit('buildIntakeCandidatesFromDc block not found')
t2 = t2.replace(old2, new2)
# Update selectNextIntakeAskForSession to pass blueprint
t2 = t2.replace(
    '...buildIntakeCandidatesFromDc(dc),',
    '...buildIntakeCandidatesFromDc(dc, input.session.decision_blueprint),',
)
p2.write_text(t2, encoding='utf-8')
print('production-intake-ask patched')
