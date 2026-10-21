/**
 * Deliverable blank HTML templates (bundled string exports).
 */

export {
  BASELINE_PROFILE_TEMPLATE,
  BASELINE_EMPTY_BODY,
} from "./baseline-profile";
export { DECISION_REPORT_TEMPLATE } from "./decision-report";
export { REMINDERS_30D_TEMPLATE } from "./reminders-30d";

export const TEMPLATE_IDS = [
  "baseline-profile",
  "decision-report",
  "reminders-30d",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];
