from pathlib import Path

p = Path(r"lib/poju/decision-intake/types.ts")
text = p.read_text(encoding="utf-8")

old = """export type InvestigationDirection = {
  direction_id: string;
  priority: \"P0\" | \"P1\" | \"P2\";
  label: string;
  dir_ids: string[];
  needed_info: string;
  completion_criteria: string;
  depth_soft_cap: number;
  scope_boundary: string;
};"""

new = """export type InvestigationDirection = {
  direction_id: string;
  priority: \"P0\" | \"P1\" | \"P2\";
  label: string;
  dir_ids: string[];
  /** Catalog DDR ids linked to this direction (many DDR per DIR allowed). */
  ddr_ids: string[];
  needed_info: string;
  completion_criteria: string;
  depth_soft_cap: number;
  scope_boundary: string;
  dependencies: string[];
};"""

if old not in text:
    raise SystemExit("InvestigationDirection block not found")
text = text.replace(old, new)

old2 = """export type DecisionBlueprint = {
  blueprint_id: string;
  blueprint_version: number;
  ddr_version: string;
  dir_catalog_version: string;
  session_id: string;
  context_id: string;
  decision_question: string | null;
  definition_snapshot: DecisionContext[\"definition\"];
  directions: InvestigationDirection[];
  dir_ids: string[];
  scope_locked: boolean;
  question_budget: { soft: number; hard: number; depth_per_direction: number };
  created_at: string;
  updated_at: string;
};"""

new2 = """export type DecisionBlueprint = {
  blueprint_id: string;
  blueprint_version: number;
  ddr_version: string;
  dir_catalog_version: string;
  session_id: string;
  context_id: string;
  decision_question: string | null;
  definition_snapshot: DecisionContext[\"definition\"];
  directions: InvestigationDirection[];
  dir_ids: string[];
  /** Selected Catalog DDR ids for this Blueprint scope. */
  ddr_ids: string[];
  topic_tags: string[];
  page_07_emit: boolean;
  /** catalog = question-specific Catalog scope; starter_fallback = controlled fallback only. */
  scope_source: \"catalog\" | \"starter_fallback\";
  scope_locked: boolean;
  question_budget: { soft: number; hard: number; depth_per_direction: number };
  created_at: string;
  updated_at: string;
};"""

if old2 not in text:
    raise SystemExit("DecisionBlueprint block not found")
text = text.replace(old2, new2)
p.write_text(text, encoding="utf-8")
print("types updated")
