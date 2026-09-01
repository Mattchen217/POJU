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
  deliveryConfirmSummaryCta,
  deliverySupplementButtonLabel,
  ensureDeliveryConfirmCta,
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
  assert("UI gate confirm starts synthesis", ui.includes("startSynthesisAfterGateConfirm"));
  {
    const confirmIdx = ui.indexOf("async function handleDeliveryConfirmGateClick");
    const synthIdx = ui.indexOf("const started = await startSynthesisAfterGateConfirm", confirmIdx);
    const beforeSynth = confirmIdx >= 0 && synthIdx > confirmIdx ? ui.slice(confirmIdx, synthIdx) : "";
    assert(
      "confirm does not open empty delivery shelf before synthesis poll",
      Boolean(beforeSynth) && !beforeSynth.includes('setDeliveryRitual("shelf")'),
    );
  }
  {
    const synthCompleteIdx = ui.indexOf("async function handleSynthesisJobComplete");
    const finalizeIdx = ui.indexOf("await finalizeSynthesisJobSuccess", synthCompleteIdx);
    const beforeFinalize =
      synthCompleteIdx >= 0 && finalizeIdx > synthCompleteIdx
        ? ui.slice(synthCompleteIdx, finalizeIdx)
        : "";
    assert(
      "synthesis complete opens delivery shelf before final-delivery poll",
      Boolean(beforeFinalize) && beforeFinalize.includes('setDeliveryRitual("shelf")'),
    );
  }
  assert("control applyDeliveryConfirmationSupplement", control.includes("applyDeliveryConfirmationSupplement"));
  assert("control startDeliveryAfterGateConfirm (legacy/regenerate path)", control.includes("startDeliveryAfterGateConfirm"));
  assert("zh chip labels", zhMsgs.includes('"delivery_confirm": "确认并继续"'));
  assert("zh supplement label", zhMsgs.includes('"delivery_supplement": "补充并修正"'));
  assert(
    "zh chips match understanding gate",
    zhMsgs.includes('"understanding_gate_confirm": "确认并继续"') &&
      zhMsgs.includes('"understanding_gate_supplement": "补充并修正"'),
  );

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
  assert(
    "classifier still accepts legacy zh confirm",
    classifyConfirmationAffirmative("可以，没有补充了") === "confirmed",
  );

  const zhCta = deliveryConfirmSummaryCta("zh");
  const enCta = deliveryConfirmSummaryCta("en");
  assert("zh CTA mentions synthesis", zhCta.includes("汇总收敛") && zhCta.includes("破局方案"));
  assert("zh CTA has confirm chip", zhCta.includes("确认并继续"));
  assert("zh CTA has supplement chip", zhCta.includes("补充并修正"));
  assert("zh CTA uses bold brackets", zhCta.includes("**[") && zhCta.includes("]**"));
  assert("en CTA mentions plan", enCta.toLowerCase().includes("plan") || enCta.toLowerCase().includes("synthesis"));
  assert(
    "ensure appends CTA",
    ensureDeliveryConfirmCta("度是正合我意，但卡在不知道怎么跟对方开口谈。", "zh").includes(zhCta),
  );
  assert(
    "ensure replaces weak CTA",
    ensureDeliveryConfirmCta(
      "总结完了。\n\n如果以上都准确，请点可以，没有补充了；如果还有要补充或修正的，请点我还要补充。",
      "zh",
    ).includes("汇总收敛"),
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
  assert("runtime confirm stays awaiting_confirmation", confirmed.next_state === "awaiting_confirmation");
  assert("runtime confirm triggers synthesis", confirmed.trigger_synthesis === true);
  assert("runtime confirm does not trigger delivery", confirmed.trigger_delivery === false);

  const supplement = advanceStateMachine(
    agent,
    extractModelTurnSignals({ confirmation_signal: "wants_to_add" }),
    deliverySupplementButtonLabel("zh"),
  );
  assert("runtime supplement → collecting", supplement.next_state === "collecting_context");
  assert("runtime supplement no delivery", supplement.trigger_delivery === false);
  assert("runtime supplement no synthesis", supplement.trigger_synthesis === false);

  const collecting = read("lib/llm/phases/collecting-phase.ts");
  assert(
    "collecting post-confirm absorb directive",
    collecting.includes("用户从核对阶段回来补充") && collecting.includes("context_updates"),
  );
  assert(
    "prompt CTA mentions synthesis weave",
    read("lib/llm/prompts/poju-base.ts").includes("汇总收敛") &&
      read("lib/llm/prompts/poju-base.ts").includes("破局方案"),
  );
  assert(
    "collecting-v6 ensures CTA",
    read("lib/llm/phases/collecting-phase-v6.ts").includes("ensureDeliveryConfirmCta"),
  );

  assert(
    "ensureDeliveryConfirmCta scrubs retune jargon",
    !ensureDeliveryConfirmCta(
      "看书、听音乐，都是在给干涸的系统补水补木。\n\n若以上对齐准确，请点确认",
      "zh",
    ).includes("补水补木"),
  );
  assert(
    "ensureDeliveryConfirmCta replaces with vernacular",
    ensureDeliveryConfirmCta(
      "看书、听音乐，都是在给干涸的系统补水补木。",
      "zh",
    ).includes("重建恢复"),
  );

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All delivery-confirm-gate checks passed.\n");
}

main();
