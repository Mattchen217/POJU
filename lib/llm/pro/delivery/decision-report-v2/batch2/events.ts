import type {
  ReportBatch2ApplicabilityEventData,
  ReportBatch2GenerateEventData,
  ReportBatch2OrchestrateEventData,
  ReportBatch2RecoverEventData,
  ReportBatch2RepairEventData,
} from "./types";

export const REPORT_BATCH2_EVENTS = {
  ORCHESTRATE: "report/page.orchestrate.requested",
  GENERATE: "report/page.generate.requested",
  REPAIR: "report/page.repair.requested",
  APPLICABILITY: "report/page.applicability.requested",
  RECOVER: "report/page.recover.requested",
} as const;

export type ReportBatch2EventName =
  (typeof REPORT_BATCH2_EVENTS)[keyof typeof REPORT_BATCH2_EVENTS];

export type ReportBatch2EventPayload =
  | { name: typeof REPORT_BATCH2_EVENTS.ORCHESTRATE; data: ReportBatch2OrchestrateEventData }
  | { name: typeof REPORT_BATCH2_EVENTS.GENERATE; data: ReportBatch2GenerateEventData }
  | { name: typeof REPORT_BATCH2_EVENTS.REPAIR; data: ReportBatch2RepairEventData }
  | { name: typeof REPORT_BATCH2_EVENTS.APPLICABILITY; data: ReportBatch2ApplicabilityEventData }
  | { name: typeof REPORT_BATCH2_EVENTS.RECOVER; data: ReportBatch2RecoverEventData };