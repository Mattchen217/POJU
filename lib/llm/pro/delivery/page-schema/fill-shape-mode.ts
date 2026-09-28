/**
 * Fill shape-anchor mode (Gate 0).
 *
 * - skeleton: zero-narrative field shape only (preferred end state)
 * - mock: legacy few-shot from mock fixture (rollback / grayscale control)
 *
 * Default = mock until ops flips DELIVERY_FILL_SHAPE_MODE=skeleton and
 * structural failure rates look safe — then flip default to skeleton and
 * delete the mock path.
 */

export type DeliveryFillShapeMode = "skeleton" | "mock";

export function resolveDeliveryFillShapeMode(
  env: NodeJS.ProcessEnv = process.env,
): DeliveryFillShapeMode {
  const raw = env.DELIVERY_FILL_SHAPE_MODE?.trim().toLowerCase() ?? "";
  if (raw === "skeleton" || raw === "shape" || raw === "empty") return "skeleton";
  if (raw === "mock" || raw === "few_shot" || raw === "few-shot" || raw === "fixture") {
    return "mock";
  }
  // Safe default during Gate 0 rollout: keep legacy until grayscale proves skeleton.
  return "mock";
}

/**
 * One LLM admit per invoke (dispatch SSOT).
 * Quality fails hard-stop — fix prompt/feed; never in-process lottery retry.
 * Transport stalls → fresh invoke + provider escape (Lab/DAG), not stacked here.
 */
export function pageSchemaFillMaxAttempts(
  _mode: DeliveryFillShapeMode = resolveDeliveryFillShapeMode(),
): number {
  return 1;
}
