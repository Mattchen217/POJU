/**
 * Phase-3 delivery confirmation gate (composer chips → Phase 4).
 *
 *   pnpm exec tsx scripts/test-poju-delivery-confirm-gate.ts
 */
import fs from "node:fs";
import path from "node:path";
import { classifyConfirmationAffirmative } from "@/lib/poju/confirmation-reply";
import {
  deliveryConfirmButtonLabel,
  deliverySupplementButtonLabel,
} from "@/lib/poju/delivery-confirm-reply";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU · Delivery confirm gate ==========\n");

  const ui = read("components/poju/POJUChatUI.tsx");
  const control = read("lib/poju/phases/delivery/control.ts");
  const zhMsgs = read("messages/zh.json");

  assert("UI delivery confirm gate handler", ui.includes("handleDeliveryConfirmGateClick"));
  assert("UI composer options for awaiting_confirmation", ui.includes("deliveryConfirmButtonLabel"));
  assert("control applyDeliveryConfirmationSupplement", control.includes("applyDeliveryConfirmationSupplement"));
  assert("control startDeliveryAfterGateConfirm", control.includes("startDeliveryAfterGateConfirm"));
  assert("zh chip labels", zhMsgs.includes('"delivery_confirm": "可以，没有补充了"'));
  assert("zh supplement label", zhMsgs.includes('"delivery_supplement": "我还要补充"'));

  assert(
    "classifier confirm chip",
    classifyConfirmationAffirmative(deliveryConfirmButtonLabel("zh")) === "confirmed",
  );
  assert(
    "classifier supplement chip",
    classifyConfirmationAffirmative(deliverySupplementButtonLabel("zh")) === "wants_to_add",
  );
  assert(
    "classifier en confirm chip",
    classifyConfirmationAffirmative(deliveryConfirmButtonLabel("en")) === "confirmed",
  );

  const agent = {
    ...createInitialAgentState({ original_question: "test" }),
    current_phase: "awaiting_confirmation" as const,
    investigation_agenda: [
      { id: "a1", label: "A", critical: true, status: "covered" as const },
      { id: "a2", label: "B", critical: true, status: "covered" as const },
      { id: "a3", label: "C", critical: false, status: "covered" as const },
    ],
  };

  const confirmed = advanceStateMachine(
    agent,
    extractModelTurnSignals({ confirmation_signal: "confirmed", user_confirms_delivery: true }),
    deliveryConfirmButtonLabel("zh"),
  );
  assert("runtime confirm → delivery", confirmed.next_state === "delivery");
  assert("runtime confirm triggers delivery", confirmed.trigger_delivery === true);

  const supplement = advanceStateMachine(
    agent,
    extractModelTurnSignals({ confirmation_signal: "wants_to_add" }),
    deliverySupplementButtonLabel("zh"),
  );
  assert("runtime supplement → collecting", supplement.next_state === "collecting_context");
  assert("runtime supplement no delivery", supplement.trigger_delivery === false);

  const collecting = read("lib/llm/phases/collecting-phase.ts");
  assert(
    "collecting post-confirm absorb directive",
    collecting.includes("用户从核对阶段回来补充") && collecting.includes("context_updates"),
  );
  assert(
    "prompt CTA points to input chips",
    read("lib/llm/prompts/poju-base.ts").includes("请在输入框选择「可以，没有补充了」"),
  );

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All delivery-confirm-gate checks passed.\n");
}

main();
