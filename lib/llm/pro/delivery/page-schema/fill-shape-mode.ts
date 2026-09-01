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

/** Structural fill retries — bumped to 3 while skeleton is grayscale (restore to 2 later). */
export function pageSchemaFillMaxAttempts(
  mode: DeliveryFillShapeMode = resolveDeliveryFillShapeMode(),
): number {
  return mode === "skeleton" ? 3 : 2;
}
