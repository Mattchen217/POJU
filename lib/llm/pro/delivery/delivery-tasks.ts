import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

export type DeliveryTask = {
  name: string;
  paths: readonly DeliverySegmentKey[];
};

/**
 * 9 prose sections → 5 parallel tasks.
 * action + retune are the paid heart — alone; energy alone (算力可见).
 */
export const DELIVERY_TASKS: readonly DeliveryTask[] = [
  { name: "deliver_preface_energy", paths: ["preface", "energy"] },
  { name: "deliver_situation_crossroads", paths: ["situation", "crossroads"] },
  { name: "deliver_action", paths: ["action"] },
  { name: "deliver_retune", paths: ["retune"] },
  { name: "deliver_rhythm_awareness_epilogue", paths: ["rhythm", "awareness", "epilogue"] },
] as const;

export function getDeliveryTaskByName(name: string): DeliveryTask | undefined {
  return DELIVERY_TASKS.find((t) => t.name === name);
}
