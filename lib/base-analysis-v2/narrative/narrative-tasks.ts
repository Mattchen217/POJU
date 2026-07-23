/**
 * Write-phase Task names/paths — browser-safe (no OpenRouter imports).
 */
import { SEGMENT_PATHS } from "@/lib/base-analysis-v2/report-schema";

export type NarrativeTask = { name: string; paths: readonly string[] };

function pathsOf(prefix: string): string[] {
  return SEGMENT_PATHS.filter((p) => p.startsWith(`${prefix}.`));
}

/**
 * 业务模块分组（按 SECTION_LAYOUT，4 Task）
 * Task1 energy_map(4) · Task2 work+interpersonal(6) · Task3 phase(4) · Task4 retune+card(5)
 */
export const NARRATIVE_TASKS: readonly NarrativeTask[] = [
  { name: "energy_map", paths: pathsOf("energy_map") },
  {
    name: "work_interpersonal",
    paths: [...pathsOf("work_style"), ...pathsOf("interpersonal")],
  },
  { name: "phase_states", paths: pathsOf("phase_states") },
  {
    name: "retune_card",
    paths: [...pathsOf("retune"), "summary.card_basis"],
  },
] as const;

export const EVIDENCE_TASKS = NARRATIVE_TASKS;

export type NarrativeTaskName = (typeof NARRATIVE_TASKS)[number]["name"];
export type EvidenceTaskName = NarrativeTaskName;

export function getNarrativeTaskByName(name: string): NarrativeTask | undefined {
  return NARRATIVE_TASKS.find((t) => t.name === name);
}

export function getEvidenceTaskByName(name: string): NarrativeTask | undefined {
  return getNarrativeTaskByName(name);
}
