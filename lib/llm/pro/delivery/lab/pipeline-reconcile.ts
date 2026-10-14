/**
 * Stage4 / full_pipeline delivery unlock reconcile — pure decision helpers.
 * Server async apply lives in pipeline-jobs; UI + job poll use these contracts.
 */

export type DeliveryReconcileAction =
  | "noop"
  | "apply_pending"
  | "probe_latest_synthesis"
  | "seed_from_chat";

export type DeliveryJobUnlockHint = "wait" | "unlock_eligible" | "failed" | "unknown";

/** True when breakthrough_core already carries primary + backup paths (synthesis writeback). */
export function coreHasSynthesisPaths(core: unknown): boolean {
  if (!core || typeof core !== "object") return false;
  const c = core as { primary_path?: unknown; backup_path?: unknown };
  return (
    typeof c.primary_path === "object" &&
    c.primary_path != null &&
    typeof c.backup_path === "object" &&
    c.backup_path != null
  );
}

/** Chat/agent already has enough synthesis signal to seed + unlock delivery. */
export function chatReadyForDeliveryUnlock(input: {
  synthesis_status?: string | null;
  breakthrough_core?: unknown;
}): boolean {
  if (input.synthesis_status === "done") return true;
  return coreHasSynthesisPaths(input.breakthrough_core);
}

/**
 * Map xhigh job status → whether delivery should unlock from that job.
 * completed → unlock_eligible (poll/apply should clear UI lock).
 */
export function deliveryUnlockHintFromJobStatus(
  status: string | null | undefined,
): DeliveryJobUnlockHint {
  if (status == null || status === "") return "unknown";
  if (status === "pending" || status === "running") return "wait";
  if (status === "completed") return "unlock_eligible";
  if (status === "failed") return "failed";
  return "unknown";
}

/**
 * Decide how to reconcile a locked full_pipeline lab toward delivery unlock.
 * Order matches labReconcileFullPipeline: pending apply → probe latest → seed from chat.
 */
export function decideDeliveryReconcile(input: {
  mode?: string | null;
  pipeline_delivery_unlocked?: boolean;
  has_chat_session: boolean;
  has_pending_job: boolean;
  synthesis_status?: string | null;
  breakthrough_core?: unknown;
  /** When known without KV (tests / client): latest synthesis job status. */
  latest_synthesis_job_status?: string | null;
}): DeliveryReconcileAction {
  if (input.mode !== "full_pipeline" || !input.has_chat_session) return "noop";
  if (input.pipeline_delivery_unlocked) return "noop";

  if (input.has_pending_job) return "apply_pending";

  if (
    chatReadyForDeliveryUnlock({
      synthesis_status: input.synthesis_status,
      breakthrough_core: input.breakthrough_core,
    })
  ) {
    return "seed_from_chat";
  }

  const hint = deliveryUnlockHintFromJobStatus(input.latest_synthesis_job_status);
  if (hint === "unlock_eligible" || hint === "wait" || hint === "failed") {
    // wait/failed still probe so poll can salvage / finalize failure UI; completed → apply via probe.
    return "probe_latest_synthesis";
  }

  // No pending pointer and no chat writeback — still try latest job recovery (ops stuck Case B).
  return "probe_latest_synthesis";
}

/**
 * Client/ops: keep auto-refreshing while delivery is locked so job completion
 * flips delivery_steps_locked without ops force-unlock.
 */
export function shouldAutoRefreshLockedDelivery(input: {
  delivery_steps_locked: boolean;
  has_pending_job: boolean;
}): boolean {
  // Pending job: LabPipelinePanel polls /jobs/*; still allow page GET when pending is gone.
  return input.delivery_steps_locked && !input.has_pending_job;
}
