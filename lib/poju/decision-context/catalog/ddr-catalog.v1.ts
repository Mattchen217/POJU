/**
 * DDR Instance Catalog SSOT — version 1.1 (Phase 2 ddr_catalog_version = 1.1).
 * Runtime authority: this module only. Do not parse PHASE-2-DDR-CATALOG.md at runtime.
 * Definitions only — live DDR status is computed, never stored here.
 */

export const DDR_CATALOG_VERSION = "1.1" as const;

export type DdrPriority = "P0" | "P1" | "P2";

export type DdrDefinitionEntry = {
  readonly ddr_id: string;
  readonly name: string;
  readonly purpose: string;
  readonly priority: DdrPriority;
  readonly required_dir_ids: readonly string[];
  readonly report_page_id: string;
  readonly report_section_id: string;
  readonly completion_criteria: string;
  readonly affects_option_ranking: boolean;
  readonly decision_critical: boolean;
  /** Always-on for Blueprint seed, except DDR-07 which is topic-gated. */
  readonly always_on: boolean;
  readonly topic_gated: boolean;
};

const RAW: DdrDefinitionEntry[] = [
  {
    ddr_id: "DDR-01-PRIMARY",
    name: "Primary recommendation",
    purpose: "Frame the primary recommendation",
    priority: "P0",
    required_dir_ids: [
      "DIR-DEF-QUESTION",
      "DIR-DEF-OUTCOME",
      "DIR-OPT-ON-TABLE",
      "DIR-STATUS-QUO",
    ],
    report_page_id: "01",
    report_section_id: "A",
    completion_criteria: "Question, outcome, options, status quo known or N/A with evidence",
    affects_option_ranking: true,
    decision_critical: true,
    always_on: true,
    topic_gated: false,
  },
  {
    ddr_id: "DDR-01-HOLD-CONDITIONS",
    name: "Hold conditions",
    purpose: "State when the recommendation holds",
    priority: "P0",
    required_dir_ids: [
      "DIR-DEF-STAKES",
      "DIR-OPT-CONSTRAINTS",
      "DIR-TIMING-WINDOW",
    ],
    report_page_id: "01",
    report_section_id: "B",
    completion_criteria: "Stakes, constraints, timing window resolved",
    affects_option_ranking: true,
    decision_critical: true,
    always_on: true,
    topic_gated: false,
  },
  {
    ddr_id: "DDR-01-ANTI-PATH",
    name: "Anti-path",
    purpose: "Name the path that must not be taken",
    priority: "P0",
    required_dir_ids: ["DIR-OPT-ON-TABLE", "DIR-DEF-UNACCEPTABLE"],
    report_page_id: "01",
    report_section_id: "C",
    completion_criteria: "Options + unacceptable outcomes known",
    affects_option_ranking: true,
    decision_critical: true,
    always_on: true,
    topic_gated: false,
  },
  {
    ddr_id: "DDR-02-ATTRIBUTION",
    name: "Attribution",
    purpose: "Attribute the situation with CFP-backed sources",
    priority: "P0",
    required_dir_ids: [
      "DIR-DEF-QUESTION",
      "DIR-STATUS-QUO",
      "DIR-PAST-ATTEMPTS",
    ],
    report_page_id: "02",
    report_section_id: "A",
    completion_criteria: "Question/status/past attempts + CFP source check",
    affects_option_ranking: false,
    decision_critical: true,
    always_on: true,
    topic_gated: false,
  },
  {
    ddr_id: "DDR-02-SCIENCE-BRIDGE",
    name: "Science bridge",
    purpose: "Bridge constraints to testable claims",
    priority: "P1",
    required_dir_ids: [
      "DIR-DEF-QUESTION",
      "DIR-OPT-CONSTRAINTS",
      "DIR-VALIDATION-CAPACITY",
    ],
    report_page_id: "02",
    report_section_id: "B",
    completion_criteria: "Question, constraints, validation capacity resolved",
    affects_option_ranking: false,
    decision_critical: false,
    always_on: true,
    topic_gated: false,
  },
  {
    ddr_id: "DDR-03-CHART-APPENDIX",
    name: "Chart appendix",
    purpose: "Source-backed chart appendix (CFP required)",
    priority: "P2",
    required_dir_ids: [],
    report_page_id: "03",
    report_section_id: "A",
    completion_criteria: "CFP source_ok or explicit N/A evidence",
    affects_option_ranking: false,
    decision_critical: false,
    always_on: true,
    topic_gated: false,
  },
  {
    ddr_id: "DDR-04-BLOCKERS",
    name: "Blockers",
    purpose: "Surface blockers that kill options",
    priority: "P1",
    required_dir_ids: [
      "DIR-OPT-CONSTRAINTS",
      "DIR-RISK-TOLERANCE",
      "DIR-OPT-IRREV",
    ],
    report_page_id: "04",
    report_section_id: "A",
    completion_criteria: "Constraints, risk, irreversibility resolved",
    affects_option_ranking: true,
    decision_critical: true,
    always_on: true,
    topic_gated: false,
  },
  {
    ddr_id: "DDR-05-RANKING",
    name: "Option ranking",
    purpose: "Rank options against priorities",
    priority: "P0",
    required_dir_ids: [
      "DIR-OPT-ON-TABLE",
      "DIR-DEF-PRIORITIES",
      "DIR-DEF-OUTCOME",
      "DIR-OPT-CONSTRAINTS",
    ],
    report_page_id: "05",
    report_section_id: "A",
    completion_criteria: "Options, priorities, outcome, constraints known",
    affects_option_ranking: true,
    decision_critical: true,
    always_on: true,
    topic_gated: false,
  },
  {
    ddr_id: "DDR-05-SWITCH-STOP",
    name: "Switch/stop criteria",
    purpose: "When to switch or stop",
    priority: "P1",
    required_dir_ids: [
      "DIR-EXIT-CRITERIA",
      "DIR-TIMING-WINDOW",
      "DIR-RISK-TOLERANCE",
    ],
    report_page_id: "05",
    report_section_id: "D",
    completion_criteria: "Exit, timing, risk resolved",
    affects_option_ranking: true,
    decision_critical: false,
    always_on: true,
    topic_gated: false,
  },
  {
    ddr_id: "DDR-06-VALIDATION",
    name: "Validation plan",
    purpose: "Cheap validation before lock-in",
    priority: "P1",
    required_dir_ids: [
      "DIR-VALIDATION-CAPACITY",
      "DIR-OPT-IRREV",
      "DIR-DEF-OUTCOME",
    ],
    report_page_id: "06",
    report_section_id: "A",
    completion_criteria: "Validation capacity, irreversibility, outcome resolved",
    affects_option_ranking: false,
    decision_critical: false,
    always_on: true,
    topic_gated: false,
  },
  {
    ddr_id: "DDR-06-RHYTHM",
    name: "Rhythm",
    purpose: "Timing rhythm for action",
    priority: "P2",
    required_dir_ids: ["DIR-TIMING-WINDOW"],
    report_page_id: "06",
    report_section_id: "C",
    completion_criteria: "Timing window known or N/A",
    affects_option_ranking: false,
    decision_critical: false,
    always_on: true,
    topic_gated: false,
  },
  {
    ddr_id: "DDR-07-TOPIC-DEPTH",
    name: "Topic depth",
    purpose: "Topic-pack investigation when applicable",
    priority: "P1",
    required_dir_ids: [], // filled at Blueprint init from topic packs
    report_page_id: "07",
    report_section_id: "A",
    completion_criteria: "Topic pack DIR(s) known or N/A with applicability evidence",
    affects_option_ranking: true,
    decision_critical: false,
    always_on: false,
    topic_gated: true,
  },
  {
    ddr_id: "DDR-08-BOUNDARIES",
    name: "Boundaries close",
    purpose: "Close with exit / unacceptable / risk boundaries",
    priority: "P0",
    required_dir_ids: [
      "DIR-EXIT-CRITERIA",
      "DIR-DEF-UNACCEPTABLE",
      "DIR-RISK-TOLERANCE",
    ],
    report_page_id: "08",
    report_section_id: "A",
    completion_criteria: "Exit, unacceptable, risk resolved",
    affects_option_ranking: false,
    decision_critical: true,
    always_on: true,
    topic_gated: false,
  },
];

function freezeEntries(
  entries: DdrDefinitionEntry[],
): readonly DdrDefinitionEntry[] {
  for (const e of entries) {
    Object.freeze(e.required_dir_ids);
    Object.freeze(e);
  }
  return Object.freeze(entries);
}

export const DDR_CATALOG_V1_ENTRIES: readonly DdrDefinitionEntry[] =
  freezeEntries(RAW);

export function ddrDefinitionById(
  ddrId: string,
): DdrDefinitionEntry | undefined {
  return DDR_CATALOG_V1_ENTRIES.find((e) => e.ddr_id === ddrId);
}

/** Reverse index: DIR → consuming DDR ids (from catalog required_dir_ids). */
export function buildDirToDdrIndex(
  entries: readonly DdrDefinitionEntry[] = DDR_CATALOG_V1_ENTRIES,
): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, string[]>();
  for (const ddr of entries) {
    for (const dirId of ddr.required_dir_ids) {
      const prev = map.get(dirId) ?? [];
      if (!prev.includes(ddr.ddr_id)) prev.push(ddr.ddr_id);
      map.set(dirId, prev);
    }
  }
  // Topic pack DIRs consume DDR-07 when seeded.
  for (const topicDir of [
    "DIR-REL-DYNAMICS",
    "DIR-JOB-OFFER",
    "DIR-BIZ-MODEL",
    "DIR-LOCALE-MOVE",
    "DIR-EDU-PATH",
  ]) {
    const prev = map.get(topicDir) ?? [];
    if (!prev.includes("DDR-07-TOPIC-DEPTH")) prev.push("DDR-07-TOPIC-DEPTH");
    map.set(topicDir, prev);
  }
  return map;
}

export const DIR_TO_DDR_INDEX_V1: ReadonlyMap<string, readonly string[]> =
  buildDirToDdrIndex();
