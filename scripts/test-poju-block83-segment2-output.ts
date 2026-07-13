/**
 * Block 83 — segment 2 shows directions + glossary fixes
 *
 *   pnpm exec tsx scripts/test-poju-block83-segment2-output.ts
 */
import fs from "node:fs";
import path from "node:path";
import { BARE_GANZHI_MARKER } from "@/lib/glossary/term-closed-set";
import {
  buildCollectingTransitionReplyFromCore,
  formatBreakthroughDirectionsForUser,
} from "@/lib/poju/collecting-focus-reply";
import { toShenshaId } from "@/lib/poju/shensha";
import { autoMarkBareTerms } from "@/lib/llm/sanitize/term-marking";
import type { POJUAgentState } from "@/lib/poju/agent-state";

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
  console.log("\n========== POJU Block 83 · Segment 2 output ==========\n");

  const collecting = read("lib/poju/collecting-focus-reply.ts");
  const route = read("app/api/poju/breakthrough-core/route.ts");
  const shensha = read("lib/poju/data/shensha-i18n-map.json");

  assert("formatBreakthroughDirectionsForUser exported", collecting.includes("formatBreakthroughDirectionsForUser"));
  assert("transition includes directions block", collecting.includes("formatBreakthroughDirectionsForUser(core"));
  assert("core route validates mapBreakthroughCorePayload", route.includes("mapBreakthroughCorePayload(parsed)"));
  assert("core route single attempt", route.includes("max_attempts: 1"));

  assert("bare ganzhi gloss user-facing", !BARE_GANZHI_MARKER.glossZh.includes("底层数据"));
  assert("bare ganzhi gloss scenario", BARE_GANZHI_MARKER.glossZh.includes("时间气候"));

  assert("execution_edge aliases", shensha.includes('"execution_edge"') && /羊刃/.test(shensha));
  assert("disruption_friction aliases", shensha.includes('"disruption_friction"') && shensha.includes('"劫煞"'));

  assert("羊刃 shensha id", toShenshaId("羊刃") === "execution_edge");
  assert("劫煞 shensha id", toShenshaId("劫煞") === "disruption_friction");

  const markedYang = autoMarkBareTerms("命局见羊刃与正官并立。", "zh");
  assert("羊刃 auto-marked", markedYang.includes("⟦t:") && !/命局见羊刃/.test(markedYang));
  const markedJie = autoMarkBareTerms("流年逢劫煞冲动。", "zh");
  assert("劫煞 auto-marked", markedJie.includes("⟦t:") && !/逢劫煞/.test(markedJie));

  const agent = {
    breakthrough_core: {
      relationship_conclusion: "你在关系里容易先退后守。",
      breakthrough_directions: [
        {
          direction: "先稳住边界再谈合作",
          structural_basis: "正官与羊刃并立",
          timing: "今年下半年",
          what_would_confirm: "对方愿意按你的节奏来",
        },
        {
          direction: "把经验沉淀成可交接的模块",
          structural_basis: "乙木日主需扎根",
          timing: "未来两年",
          what_would_confirm: "有徒弟主动来问",
        },
      ],
      generated_at: new Date().toISOString(),
    },
    investigation_agenda: [
      { id: "a1", label: "你最想先动哪一步？", critical: true, status: "unexplored" },
    ],
  } as unknown as POJUAgentState;

  const dirs = formatBreakthroughDirectionsForUser(agent.breakthrough_core, "zh");
  assert("directions block has header", dirs.includes("破局方向"));
  assert("directions block has timing", dirs.includes("今年下半年"));

  const reply = buildCollectingTransitionReplyFromCore(agent, "zh");
  assert("reply has conclusion", reply.includes("先退后守"));
  assert("reply has directions", reply.includes("先稳住边界"));
  assert("reply has agenda question", reply.includes("你最想先动哪一步"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 83 checks passed.\n");
}

main();
