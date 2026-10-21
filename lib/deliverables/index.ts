/**
 * HTML-first deliverables: blank templates + slot fill + persist helpers.
 */

export {
  fillDeliverableHtml,
  listTemplateSlots,
  assertSkeletonUnchanged,
} from "./fill-html";

export {
  BASELINE_PROFILE_TEMPLATE,
  BASELINE_EMPTY_BODY,
  DECISION_REPORT_TEMPLATE,
  REMINDERS_30D_TEMPLATE,
  TEMPLATE_IDS,
  type TemplateId,
} from "./templates";

export {
  buildBaselineSlotMap,
  fillBaselineProfileHtml,
} from "./fill-baseline";

export {
  DECISION_REPORT_SLOT_IDS,
  buildDeliverySlotMap,
  fillDecisionReportHtml,
  type DecisionReportSlotId,
} from "./fill-delivery";

export {
  buildRemindersDayCardHtml,
  buildRemindersSlotMap,
  fillReminders30dHtml,
  type FillRemindersInput,
} from "./fill-reminders";

export {
  TEMPLATE_VERSION,
  ensureBaselineFilledHtml,
  ensureDeliveryFilledHtml,
  ensureRemindersFilledHtml,
} from "./persist";
