import { reportPageApplicability } from "./report-page-applicability";
import { reportPageGenerate } from "./report-page-generate";
import { reportPageOrchestrator } from "./report-page-orchestrator";
import { reportPageRepair } from "./report-page-repair";

export const reportBatch2InngestFunctions = [
  reportPageOrchestrator,
  reportPageGenerate,
  reportPageRepair,
  reportPageApplicability,
] as const;

export {
  reportPageOrchestrator,
  reportPageGenerate,
  reportPageRepair,
  reportPageApplicability,
};