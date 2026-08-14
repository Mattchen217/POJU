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
 * Current DAG wave incomplete tasks may run.
 * A → B(P2–P4) → C(P5 risk ∥ P6 close). Legacy thirty_day never scheduled.
 */
export function filterTasksToCurrentWave<T extends { paths: readonly DeliverySegmentKey[] }>(
  incomplete: T[],
  readyKeys: Set<DeliverySegmentKey>,
): T[] {
  const waveADone = readyKeys.has("direct_answer");
  const waveBDone =
    readyKeys.has("foundation") &&
    readyKeys.has("science_action") &&
    readyKeys.has("metaphysics_action");

  return incomplete.filter((t) => {
    const key = t.paths[0];
    if (!key) return false;
    if (key === "direct_answer") return true;
    if (key === "foundation" || key === "science_action" || key === "metaphysics_action") {
      return waveADone;
    }
    if (key === "thirty_day") return false;
    if (key === "risk_guard" || key === "signals_close") return waveBDone;
    return false;
  });
}
