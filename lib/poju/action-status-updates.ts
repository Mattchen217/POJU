import type { POJUAction } from "@/lib/poju/types";

export type ActionStatusPatch = {
  action_index?: number;
  action_id?: string;
  status: POJUAction["status"];
  feedback?: string;
};

const VALID_STATUSES = new Set<POJUAction["status"]>([
  "pending",
  "completed",
  "modified",
  "skipped",
]);

/** Map tracking-phase LLM labels → session action status. */
export function normalizeTrackingActionStatus(raw: unknown): POJUAction["status"] | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  if (VALID_STATUSES.has(t as POJUAction["status"])) return t as POJUAction["status"];
  if (t === "done" || t === "finished") return "completed";
  if (t === "doing" || t === "in_progress" || t === "started") return "pending";
  if (t === "blocked" || t === "stuck") return "skipped";
  if (t === "adjusted" || t === "tweaked") return "modified";
  return null;
}

export function parseActionStatusUpdates(parsed: Record<string, unknown>): ActionStatusPatch[] {
  const raw =
    parsed.action_status_updates ??
    (parsed.context_updates &&
    typeof parsed.context_updates === "object" &&
    !Array.isArray(parsed.context_updates)
      ? (parsed.context_updates as Record<string, unknown>).action_status_updates
      : undefined);

  if (!Array.isArray(raw)) return [];

  const patches: ActionStatusPatch[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const status = normalizeTrackingActionStatus(row.status);
    if (!status) continue;

    const action_index =
      typeof row.action_index === "number" && Number.isFinite(row.action_index)
        ? Math.trunc(row.action_index)
        : typeof row.action_index === "string" && /^\d+$/.test(row.action_index.trim())
          ? Number.parseInt(row.action_index.trim(), 10)
          : undefined;

    const action_id =
      typeof row.action_id === "string" && row.action_id.trim() ? row.action_id.trim() : undefined;

    if (!action_index && !action_id) continue;

    patches.push({
      action_index,
      action_id,
      status,
      feedback:
        typeof row.feedback === "string" && row.feedback.trim() ? row.feedback.trim() : undefined,
    });
  }
  return patches;
}

/** Apply tracking patches to delivered actions — no-op when empty or unmatched. */
export function applyActionStatusUpdates(
  actions: POJUAction[],
  patches: ActionStatusPatch[] | undefined | null,
): POJUAction[] {
  if (!patches?.length || actions.length === 0) return actions;

  const now = new Date().toISOString();
  let changed = false;
  const next = actions.map((action, idx) => {
    const patch = patches.find((p) => {
      if (p.action_id && p.action_id === action.action_id) return true;
      if (p.action_index != null && p.action_index === idx + 1) return true;
      return false;
    });
    if (!patch) return action;
    changed = true;
    return {
      ...action,
      status: patch.status,
      user_feedback: patch.feedback ?? action.user_feedback,
      updated_at: now,
    };
  });

  return changed ? next : actions;
}
