import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import {
  buildSyncroGenerationSteps,
  type SyncroGenerationStep,
} from "@/lib/syncro/syncro-generation-plan";
import {
  getRealtimeHourPeriodForSession,
  getSubmissionHourSequence,
} from "@/lib/syncro/syncro-submission-schedule";
import type { SyncroSession } from "@/lib/syncro/types";

function stepNeedsGeneration(session: SyncroSession, hourIds: SyncroGenerationStep): boolean {
  return hourIds.some((h) => !isHourPeriodLlmReady(session.matrix, h, session.llm_meta));
}

/** Remaining LLM batches after priority hour (client SSE / one Vercel request per batch). */
export function getPendingSyncroGenerationSteps(
  session: SyncroSession,
  options?: { skipPriority?: boolean },
): SyncroGenerationStep[] {
  const hourOrder = getSubmissionHourSequence(session);
  const priorityHour = getRealtimeHourPeriodForSession(session);
  const steps = buildSyncroGenerationSteps(hourOrder, priorityHour, {
    skipPriority: options?.skipPriority ?? true,
  });
  return steps.filter((step) => stepNeedsGeneration(session, step));
}
