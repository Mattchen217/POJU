/**
 * After Stage-1: lock solo | dyad path for all downstream prompts/feeds.
 */

import type { DyadCompatSummary, DyadOfferStatus, PartnerBaziPresence } from "./dyad-compat";
import type { DyadMatrixPack } from "./dyad-matrix-pack";
import type { POJUSessionState } from "./types";

export type PivotChartPath = "solo" | "dyad";

export type PivotPathLockFields = {
  pivot_chart_path: PivotChartPath;
  charts_locked_at: string;
};

/** Resolve path from Stage-1 dyad gate outcome (does not write session). */
export function resolvePivotChartPath(input: {
  partner_bazi?: PartnerBaziPresence | null;
  partner_profile_id?: string | null;
  dyad_compat_summary?: DyadCompatSummary | null;
  dyad_matrix_pack?: DyadMatrixPack | null;
  pivot_chart_path?: PivotChartPath | null;
}): PivotChartPath {
  if (input.pivot_chart_path === "solo" || input.pivot_chart_path === "dyad") {
    return input.pivot_chart_path;
  }
  const dyadReady =
    input.partner_bazi === "present" &&
    Boolean(input.partner_profile_id?.trim()) &&
    input.dyad_compat_summary != null;
  return dyadReady ? "dyad" : "solo";
}

/** True when gate was shown but user never chose collect/skip. */
export function isDyadGateUnresolved(status: DyadOfferStatus | undefined | null): boolean {
  return status === "offered";
}

/**
 * Build lock patch. Call only when gate is resolved (or never offered).
 * Throws if still `offered`.
 */
export function buildPivotChartPathLock(session: Pick<
  POJUSessionState,
  | "partner_bazi"
  | "partner_profile_id"
  | "dyad_compat_summary"
  | "dyad_matrix_pack"
  | "dyad_offer_status"
  | "pivot_chart_path"
  | "charts_locked_at"
>): PivotPathLockFields {
  if (isDyadGateUnresolved(session.dyad_offer_status)) {
    throw new Error("dyad_gate_unresolved");
  }
  if (
    session.pivot_chart_path &&
    (session.pivot_chart_path === "solo" || session.pivot_chart_path === "dyad") &&
    session.charts_locked_at
  ) {
    return {
      pivot_chart_path: session.pivot_chart_path,
      charts_locked_at: session.charts_locked_at,
    };
  }
  return {
    pivot_chart_path: resolvePivotChartPath(session),
    charts_locked_at: new Date().toISOString(),
  };
}

export function assertPivotChartPathLocked(
  session: Pick<
    POJUSessionState,
    | "partner_bazi"
    | "partner_profile_id"
    | "dyad_compat_summary"
    | "dyad_matrix_pack"
    | "dyad_offer_status"
    | "pivot_chart_path"
    | "charts_locked_at"
  >,
): PivotChartPath {
  if (isDyadGateUnresolved(session.dyad_offer_status)) {
    throw new Error("dyad_gate_unresolved");
  }
  const path = resolvePivotChartPath(session);
  if (!session.pivot_chart_path || !session.charts_locked_at) {
    throw new Error("pivot_chart_path_not_locked");
  }
  return path;
}

export function isDyadPivotPath(session: {
  pivot_chart_path?: PivotChartPath | null;
  partner_bazi?: PartnerBaziPresence | null;
}): boolean {
  if (session.pivot_chart_path === "dyad") return true;
  if (session.pivot_chart_path === "solo") return false;
  return session.partner_bazi === "present";
}
