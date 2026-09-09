/**
 * Load upstream page_schema from segment:ready for Action Brief / hints.
 */

import type { DeliverySegmentKey } from "../delivery-schema";
import { DELIVERY_SEGMENT_KEYS } from "../delivery-schema";
import { loadDeliverySegmentReady } from "../delivery-stage-store";
import { extractP5ActionBrief } from "./action-extractor";
import {
  flattenPrimaryAnchorsFromPageSchema,
} from "./anchor-category-tally";
import type { DeliveryPageData, P1Page, P3Page, P4Page, P5ActionBrief } from "./types";
import { isActionBriefUpstreamReady } from "./waves";

function asPage<T extends { page: string }>(
  data: unknown,
  page: T["page"],
): T | null {
  if (!data || typeof data !== "object") return null;
  const p = data as { page?: string };
  return p.page === page ? (data as T) : null;
}

/**
 * Collect **primary** chart_anchors (unit anchors[0]) from ready sibling pages.
 * Used for job-wide primary_reuse_cap — aux hits must not inflate any primary's count.
 */
export async function loadPriorChartAnchors(
  job_id: string,
  excludeKey: DeliverySegmentKey,
): Promise<string[]> {
  const results = await Promise.all(
    DELIVERY_SEGMENT_KEYS.filter((k) => k !== excludeKey).map((k) =>
      loadDeliverySegmentReady(job_id, k).then((ready) => ({ k, ready })),
    ),
  );
  const out: string[] = [];
  for (const { k, ready } of results) {
    const schema = ready?.page_schema;
    if (!schema || typeof schema !== "object") continue;
    out.push(
      ...flattenPrimaryAnchorsFromPageSchema(
        k,
        schema as DeliveryPageData | Record<string, unknown>,
      ),
    );
  }
  return out;
}

/**
 * Collect necessary_signals roles (+ optional dimension_id / inference_zh)
 * from sibling pages' assign progress — cross-page 流展 / same-dim inference gate.
 * Falls back to empty when Wave A peers not assigned yet.
 */
export async function loadPriorSignalRoles(
  job_id: string,
  excludeKey: DeliverySegmentKey,
): Promise<import("./assign-necessary-signals").PriorSignalRole[]> {
  const { loadDeliverySegmentProgress } = await import(
    "@/lib/llm/pro/delivery/delivery-stage-store"
  );
  const { collectPriorSignalRolesFromUnits } = await import(
    "./assign-necessary-signals"
  );
  const results = await Promise.all(
    DELIVERY_SEGMENT_KEYS.filter((k) => k !== excludeKey).map(async (k) => {
      const prog = await loadDeliverySegmentProgress(job_id, k);
      return { k, assignment: prog?.deep_evidence_assignment };
    }),
  );
  const out: import("./assign-necessary-signals").PriorSignalRole[] = [];
  for (const { k, assignment } of results) {
    if (!assignment?.units?.length) continue;
    // collectPriorSignalRolesFromUnits already forwards dimension_id / inference_zh
    out.push(...collectPriorSignalRolesFromUnits(assignment.units, k));
  }
  return out;
}

export async function loadP3BodyExcerptForP4Moat(
  job_id: string,
  maxChars = 1200,
): Promise<string> {
  const ready = await loadDeliverySegmentReady(job_id, "science_action");
  const p3 = asPage<P3Page>(ready?.page_schema, "science_action");
  if (!p3) return "";
  const bits: string[] = [];
  if (p3.opening?.trim()) bits.push(p3.opening.trim());
  for (const track of [p3.primary_toolkit, p3.backup_toolkit]) {
    for (const a of track?.angles ?? []) {
      bits.push(String(a.strategy ?? ""));
      if (Array.isArray(a.means)) {
        for (const m of a.means) {
          if (typeof m === "string") bits.push(m);
          else if (m && typeof m === "object") {
            const o = m as Record<string, unknown>;
            bits.push(String(o.text ?? o.body ?? o.action ?? ""));
          }
        }
      }
    }
  }
  return bits.join("\n").replace(/\s+/g, " ").trim().slice(0, maxChars);
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
 * | P3   | No (hint from P1 or synthesis) | loadPrimaryBackupHint ∥ breakthrough_core |
 * | P4   | No                    | agent_v2 question + breakthrough_core |
 * | P5/P6| P1+P3+P4 required | ActionBrief extractor + fuse feed |
 */
export function filterTasksToCurrentWave<T extends { paths: readonly DeliverySegmentKey[] }>(
  incomplete: T[],
  readyKeys: Set<DeliverySegmentKey>,
): T[] {
  const actionBriefReady = isActionBriefUpstreamReady(readyKeys);

  return incomplete.filter((t) => {
    const key = t.paths[0];
    if (!key) return false;
    if (key === "direct_answer") return true;
    // P2/P3/P4: no hard wait on P1 page JSON — P3 uses synthesis hint when P1 absent.
    if (key === "foundation" || key === "metaphysics_action" || key === "science_action") {
      return true;
    }
    if (key === "thirty_day") return false;
    if (key === "risk_guard" || key === "signals_close") return actionBriefReady;
    return false;
  });
}

/**
 * UI progressive unlock + `require_preface` gate need `direct_answer` first.
 * Run P1 alone until `segment:ready` — never share a wave with heavy P2/P4 fills
 * (sibling abort / soft-wall budget starvation kept the shelf blank for 20+ min).
 */
export function prioritizeBootstrapSegmentTasks<T extends { paths: readonly DeliverySegmentKey[] }>(
  incomplete: T[],
): T[] {
  const boot = incomplete.find((t) => t.paths[0] === "direct_answer");
  if (boot) return [boot];
  return incomplete;
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
