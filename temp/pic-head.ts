/**
 * M2.4-R2 — scheduling/control metadata for unresolved model aspects,
 * goal_change confirmation, and insight_mismatch clarification.
 *
 * This is not a second Decision Context or fact store and never widens
 * authorized DIRs or confirmation authority. A goal_change is applied only
 * after explicit user confirmation, through the formal Blueprint update entry
 * (goal-change-blueprint-update.ts); this module never mutates Blueprint.
 * Items from several source turns queue here; none is silently dropped.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import { LONG_ANSWER_ASPECT_TEXT } from "./answer-interpretation";
import type {
  AdaptiveQuestionPlan,
  AnswerEvent,
  IntakeControlItem,
  PendingIntakeControl,
} from "./types";

/** Uncertain follow-up replies allowed per control item before it closes. */
export const CONTROL_ITEM_MAX_UNCERTAIN_ATTEMPTS = 2;
