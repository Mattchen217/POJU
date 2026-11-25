import { reportPageApplicability } from "./report-page-applicability";
import { reportPageGenerate } from "./report-page-generate";
import { reportPageOrchestrator } from "./report-page-orchestrator";
import { reportPageRecovery } from "./report-page-recovery";
import { reportPageRepair } from "./report-page-repair";

export const reportBatch2InngestFunctions = [
  reportPageOrchestrator,
  reportPageGenerate,
  reportPageRepair,
  reportPageApplicability,
  reportPageRecovery,
] as const;

export {
  reportPageOrchestrator,
  reportPageGenerate,
  reportPageRepair,
  reportPageApplicability,
  reportPageRecovery,
};