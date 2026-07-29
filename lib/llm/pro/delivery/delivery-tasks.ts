import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

export type DeliveryTask = {
  name: string;
  paths: readonly DeliverySegmentKey[];
};

/**
 * 6 sections split into 4 parallel tasks (doc §4.3).
 * C and D are heavy — alone; A+B and E+F paired.
 */
export const DELIVERY_TASKS: readonly DeliveryTask[] = [
  { name: "deliver_a_b", paths: ["A", "B"] },
  { name: "deliver_c", paths: ["C"] },
  { name: "deliver_d", paths: ["D"] },
  { name: "deliver_e_f", paths: ["E", "F"] },
] as const;

export function getDeliveryTaskByName(name: string): DeliveryTask | undefined {
  return DELIVERY_TASKS.find((t) => t.name === name);
}
