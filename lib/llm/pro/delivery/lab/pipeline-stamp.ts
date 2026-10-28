/**
 * Lab session pipeline stamp — independent of env DELIVERY_PIPELINE.
 *
 * Live production uses `productionDeliveryUsesV3()` (unset → v3).
 * Lab create previously used `resolveDeliveryPipeline()` (unset → legacy),
 * which forked Ops quality from tonight's live gun.
 *
 * New labs stamp `decision_shelf`: same v3 executor as prod, shelf face labels.
 * Existing labs keep their stamped `legacy` / `v3_three_step`.
 */

export type LabPipelineStamp = "legacy" | "v3_three_step" | "decision_shelf";

/** New Lab sessions — prod-v3 parity, decoupled from DELIVERY_PIPELINE. */
export const DEFAULT_LAB_PIPELINE_STAMP: LabPipelineStamp = "decision_shelf";

export function labUsesV3Executor(
  pipeline: string | null | undefined,
): boolean {
  return pipeline === "v3_three_step" || pipeline === "decision_shelf";
}

export function isDecisionShelfPipeline(
  pipeline: string | null | undefined,
): boolean {
  return pipeline === "decision_shelf";
}

export function labPipelineBadge(
  pipeline: string | null | undefined,
): string {
  if (pipeline === "decision_shelf") return "decision_shelf · prod-v3";
  if (pipeline === "v3_three_step") return "v3 · 三步";
  return "legacy";
}
