/**
 * Load upstream page_schema from segment:ready for Action Brief / hints.
 */

import type { DeliverySegmentKey } from "../delivery-schema";
import { loadDeliverySegmentReady } from "../delivery-stage-store";
import { extractP5ActionBrief, extractP5WeekSummary } from "./action-extractor";
import type { P1Page, P3Page, P4Page, P5ActionBrief, P5Page, P5WeekSummary } from "./types";

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

export async function loadUpstreamWeekSummary(
  job_id: string,
): Promise<P5WeekSummary | null> {
  const r5 = await loadDeliverySegmentReady(job_id, "thirty_day");
  const p5 = asPage<P5Page>(r5?.page_schema, "thirty_day");
  if (!p5) return null;
  return extractP5WeekSummary(p5);
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

/** Current DAG wave incomplete tasks may run (no P5 before B done). */
export function filterTasksToCurrentWave<T extends { paths: readonly DeliverySegmentKey[] }>(
  incomplete: T[],
  readyKeys: Set<DeliverySegmentKey>,
): T[] {
  const waveADone = readyKeys.has("direct_answer");
  const waveBDone =
    readyKeys.has("foundation") &&
    readyKeys.has("science_action") &&
    readyKeys.has("metaphysics_action");
  const waveCDone = readyKeys.has("thirty_day");

  return incomplete.filter((t) => {
    const key = t.paths[0];
    if (!key) return false;
    if (key === "direct_answer") return true;
    if (key === "foundation" || key === "science_action" || key === "metaphysics_action") {
      return waveADone;
    }
    if (key === "thirty_day") return waveBDone;
    if (key === "risk_guard" || key === "signals_close") return waveCDone;
    return false;
  });
}
