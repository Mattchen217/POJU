/**
 * DIR N/A Catalog SSOT 鈥?version 1 (Phase 2 dir_catalog_version = 1).
 * Runtime authority: this module only. Do not parse PHASE-2-DIR-CATALOG.md at runtime.
 *
 * Phase 2 prose 鈫?token (non-empty only):
 * - DIR-DEF-STAKES: stakes unknowable + boundary 鈫?explicit_stakes_unknowable_boundary
 * - DIR-DEF-UNACCEPTABLE: no hard red lines 鈫?explicit_no_hard_red_lines
 * - DIR-STATUS-QUO: no current state 鈫?explicit_no_current_state
 * - DIR-OPT-CONSTRAINTS: no material constraints 鈫?explicit_no_material_constraints
 * - DIR-OPT-IRREV: fully reversible 鈫?explicit_fully_reversible
 * - DIR-PAST-ATTEMPTS: first-time decision 鈫?explicit_first_time_decision
 * - DIR-TIMING-WINDOW: open-ended timing 鈫?explicit_open_ended_timing
 * - DIR-EXIT-CRITERIA: no exit, all-in 鈫?explicit_no_exit_all_in
 * - DIR-VALIDATION-CAPACITY: nothing testable 鈫?explicit_nothing_testable
 * - DIR-STAKEHOLDERS: solo decision 鈫?explicit_solo_decision
 * Empty [] = Never N/A. Topic packs use topic_pack_not_applicable (S9 Topic Applicability).
 */

import type { DirNaCatalogEntry } from "../explicit-na-validate";

export const DIR_NA_CATALOG_VERSION = 1 as const;

const RAW_ENTRIES: DirNaCatalogEntry[] = [
  { dir_id: "DIR-DEF-QUESTION", na_conditions: [] },
  { dir_id: "DIR-DEF-OUTCOME", na_conditions: [] },
  {
    dir_id: "DIR-DEF-STAKES",
    na_conditions: ["explicit_stakes_unknowable_boundary"],
  },
  { dir_id: "DIR-DEF-PRIORITIES", na_conditions: [] },
  {
    dir_id: "DIR-DEF-UNACCEPTABLE",
    na_conditions: ["explicit_no_hard_red_lines"],
  },
  { dir_id: "DIR-OPT-ON-TABLE", na_conditions: [] },
  {
    dir_id: "DIR-STATUS-QUO",
    na_conditions: ["explicit_no_current_state"],
  },
  {
    dir_id: "DIR-OPT-CONSTRAINTS",
    na_conditions: ["explicit_no_material_constraints"],
  },
  {
    dir_id: "DIR-OPT-IRREV",
    na_conditions: ["explicit_fully_reversible"],
  },
  {
    dir_id: "DIR-PAST-ATTEMPTS",
    na_conditions: ["explicit_first_time_decision"],
  },
  {
    dir_id: "DIR-TIMING-WINDOW",
    na_conditions: ["explicit_open_ended_timing"],
  },
  { dir_id: "DIR-RISK-TOLERANCE", na_conditions: [] },
  {
    dir_id: "DIR-EXIT-CRITERIA",
    na_conditions: ["explicit_no_exit_all_in"],
  },
  {
    dir_id: "DIR-VALIDATION-CAPACITY",
    na_conditions: ["explicit_nothing_testable"],
  },
  {
    dir_id: "DIR-STAKEHOLDERS",
    na_conditions: ["explicit_solo_decision"],
  },
  { dir_id: "DIR-REL-DYNAMICS", na_conditions: ["topic_pack_not_applicable"] },
  { dir_id: "DIR-JOB-OFFER", na_conditions: ["topic_pack_not_applicable"] },
  { dir_id: "DIR-BIZ-MODEL", na_conditions: ["topic_pack_not_applicable"] },
  { dir_id: "DIR-LOCALE-MOVE", na_conditions: ["topic_pack_not_applicable"] },
  { dir_id: "DIR-EDU-PATH", na_conditions: ["topic_pack_not_applicable"] },
];

function deepFreezeDirNaEntries(
  entries: DirNaCatalogEntry[],
): readonly DirNaCatalogEntry[] {
  for (const entry of entries) {
    Object.freeze(entry.na_conditions);
    Object.freeze(entry);
  }
  return Object.freeze(entries);
}

/** Deep-frozen production entries for catalog version 1. */
export const DIR_NA_CATALOG_V1_ENTRIES: readonly DirNaCatalogEntry[] =
  deepFreezeDirNaEntries(RAW_ENTRIES);

