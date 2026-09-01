/**
 * Load upstream page_schema from segment:ready for Action Brief / hints.
 */

import type { DeliverySegmentKey } from "../delivery-schema";
import { loadDeliverySegmentReady } from "../delivery-stage-store";
import { extractP5ActionBrief } from "./action-extractor";
import type { P1Page, P3Page, P4Page, P5ActionBrief } from "./types";

function asPage<T extends { page: string }>(
  data: unknown,
  page: T["page"],
): T | null {
  if (!data || typeof data !== "object") return null;
  const p = data as { page?: string };
  return p.page === page ? (data as T) : null;
}

export async function loadUpstreamActionBrief(
  job_id: string,
): Promise<P5ActionBrief | null> {
  const [r1, r3, r4] = await Promise.all([
    loadDeliverySegmentReady(job_id, "direct_answer"),
    loadDeliverySegmentReady(job_id, "science_action"),
    loadDeliverySegmentReady(job_id, "metaphysics_action"),
  ]);
  const p1 = asPage<P1Page>(r1?.page_schema, "direct_answer");
  const p3 = asPage<P3Page>(r3?.page_schema, "science_action");
  const p4 = asPage<P4Page>(r4?.page_schema, "metaphysics_action");
  if (!p1 && !p3 && !p4) return null;
  return extractP5ActionBrief({ p1, p3, p4 });
}

/** @deprecated 30-day page retired — always null. */
export async function loadUpstreamWeekSummary(
  _job_id: string,
): Promise<null> {
  return null;
}

export async function loadPrimaryBackupHint(job_id: string): Promise<string> {
  const r1 = await loadDeliverySegmentReady(job_id, "direct_answer");
  const p1 = asPage<P1Page>(r1?.page_schema, "direct_answer");
  if (!p1) return "";
  return [
    `Primary: ${p1.primary.name} | when: ${p1.primary.when}`,
    `Backup: ${p1.backup.name} | when: ${p1.backup.when}`,
    `Judgment: ${p1.core_judgment}`,
  ].join("\n");
}

/**
 * Current DAG — per-page deps (not blanket Wave-B-after-P1).
 *
 * | Page | Needs P1 page_schema? | Source |
 * | P2   | No                    | finalize + breakthrough_core |
 * | P3   | Yes (primary/backup names) | loadPrimaryBackupHint → P1 |
 * | P4   | No                    | agent_v2 question + breakthrough_core |
 * | P5/P6| Yes (P1+P3+P4)        | ActionBrief extractor |
 */
export function filterTasksToCurrentWave<T extends { paths: readonly DeliverySegmentKey[] }>(
  incomplete: T[],
  readyKeys: Set<DeliverySegmentKey>,
): T[] {
  const p1Ready = readyKeys.has("direct_answer");
  const contentDone =
    p1Ready &&
    readyKeys.has("foundation") &&
    readyKeys.has("science_action") &&
    readyKeys.has("metaphysics_action");

  return incomplete.filter((t) => {
    const key = t.paths[0];
    if (!key) return false;
    if (key === "direct_answer") return true;
    // P2/P4: finalize only — no P1 page JSON required (see fill-prompt + p2/p4 duties).
    if (key === "foundation" || key === "metaphysics_action") return true;
    // P3: align primary_toolkit / backup_toolkit to P1 track names (product spec).
    if (key === "science_action") return p1Ready;
    if (key === "thirty_day") return false;
    if (key === "risk_guard" || key === "signals_close") return contentDone;
    return false;
  });
}

/** Build primary/backup hint from synthesis writeback when P1 page_schema not ready yet. */
export function buildPrimaryBackupHintFromBreakthroughCore(
  core: import("@/lib/poju/agent-state").BreakthroughCore | null | undefined,
): string {
  if (!core) return "";
  const primary = core.primary_path;
  const backup = core.backup_path;
  if (!primary?.direction?.trim() && !backup?.direction?.trim()) return "";
  const lines: string[] = [];
  if (primary?.direction?.trim()) {
    lines.push(`Primary (synthesis): ${primary.direction.trim()}`);
    if (primary.why_fits?.trim()) lines.push(`  why: ${primary.why_fits.trim()}`);
  }
  if (backup?.direction?.trim()) {
    lines.push(`Backup (synthesis): ${backup.direction.trim()}`);
    if (backup.why_fits?.trim()) lines.push(`  why: ${backup.why_fits.trim()}`);
  }
  return lines.join("\n");
}
