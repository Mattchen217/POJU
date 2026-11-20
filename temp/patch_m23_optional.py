from pathlib import Path
p = Path(r"lib/poju/decision-intake/types.ts")
text = p.read_text(encoding="utf-8")
text = text.replace(
    """  /** Catalog DDR ids linked to this direction (many DDR per DIR allowed). */
  ddr_ids: string[];
  needed_info: string;
  completion_criteria: string;
  depth_soft_cap: number;
  scope_boundary: string;
  dependencies: string[];
};""",
    """  /** Catalog DDR ids linked to this direction (many DDR per DIR allowed). */
  ddr_ids?: string[];
  needed_info: string;
  completion_criteria: string;
  depth_soft_cap: number;
  scope_boundary: string;
  dependencies?: string[];
};""",
)
text = text.replace(
    """  /** Selected Catalog DDR ids for this Blueprint scope. */
  ddr_ids: string[];
  topic_tags: string[];
  page_07_emit: boolean;
  /** catalog = question-specific Catalog scope; starter_fallback = controlled fallback only. */
  scope_source: \"catalog\" | \"starter_fallback\";
  scope_locked: boolean;""",
    """  /** Selected Catalog DDR ids for this Blueprint scope. */
  ddr_ids?: string[];
  topic_tags?: string[];
  page_07_emit?: boolean;
  /** catalog = question-specific Catalog scope; starter_fallback = controlled fallback only. */
  scope_source?: \"catalog\" | \"starter_fallback\";
  scope_locked: boolean;""",
)
p.write_text(text, encoding="utf-8")
print("types optional ok")

# Fix DDR_FOR_ in M1 adaptive test fixtures
p2 = Path(r"scripts/test-m1-production-adaptive-question-loop.ts")
t2 = p2.read_text(encoding="utf-8")
t2 = t2.replace("ddr_ids: [`DDR_FOR_${dirId}`],", "ddr_ids: [\"DDR-01-PRIMARY\"],")
p2.write_text(t2, encoding="utf-8")
print("m1 adaptive DDR_FOR replaced", t2.count("DDR_FOR_"))
