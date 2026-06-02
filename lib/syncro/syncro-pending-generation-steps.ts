import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import {
  buildSyncroGenerationSteps,
  type SyncroGenerationStep,
} from "@/lib/syncro/syncro-generation-plan";
import {
  getLivePeriodInSubmissionTimeline,
  getSubmissionHourSequence,
  isSubmissionTimelineComplete,
} from "@/lib/syncro/syncro-submission-schedule";
import type { SyncroSession } from "@/lib/syncro/types";

function stepNeedsGeneration(session: SyncroSession, hourIds: SyncroGenerationStep): boolean {
  return hourIds.some((h) => !isHourPeriodLlmReady(session.matrix, h, session.llm_meta));
}

function countReadyHours(session: SyncroSession): number {
  const sequence = getSubmissionHourSequence(session);
  let ready = 0;
  for (const hourId of sequence) {
    if (isHourPeriodLlmReady(session.matrix, hourId, session.llm_meta)) ready++;
  }
  return ready;
}

/** Remaining LLM batches after priority hour (client SSE / one Vercel request per batch). */
export function getPendingSyncroGenerationSteps(
  session: SyncroSession,
  options?: { skipPriority?: boolean },
): SyncroGenerationStep[] {
  if (isSubmissionTimelineComplete(session)) return [];
  if (countReadyHours(session) >= 12) return [];

  const hourOrder = getSubmissionHourSequence(session);
  const priorityHour = getLivePeriodInSubmissionTimeline(session) ?? hourOrder[0];
  if (!priorityHour) return [];

  const steps = buildSyncroGenerationSteps(hourOrder, priorityHour, {
    skipPriority: options?.skipPriority ?? true,
  });
  return steps.filter((step) => stepNeedsGeneration(session, step));
}
