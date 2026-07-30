/**
 * Block 83 — segment 2 shows Call A dialogue (not direction cards)
 *
 *   pnpm exec tsx scripts/test-poju-block83-segment2-output.ts
 */
import fs from "node:fs";
import path from "node:path";
import { BARE_GANZHI_MARKER } from "@/lib/glossary/term-closed-set";
import {
  buildCollectingTransitionReplyFromCore,
  formatSegment2ReplyForUser,
} from "@/lib/poju/collecting-focus-reply";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
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
  console.log("\n========== POJU Block 83 · Segment 2 dialogue output ==========\n");

  const display = read("lib/poju/phases/segment2/display.ts");
  const collecting = read("lib/poju/collecting-focus-reply.ts");
  const route = read("app/api/poju/breakthrough-core/route.ts");
  const runner = read("lib/poju/xhigh-job-runner.ts");
  const shensha = read("lib/poju/data/shensha-i18n-map.json");

  assert(
    "formatSegment2ReplyForUser exported",
    display.includes("formatSegment2ReplyForUser") || collecting.includes("formatSegment2ReplyForUser"),
  );
  assert("no 破局方向 template in display", !display.includes("### 破局方向"));
  assert(
    "core runner validates breakthrough map/sanitize",
    runner.includes("mapBreakthroughCorePayload") ||
      runner.includes("parseAndMapBreakthroughCore") ||
      runner.includes("parseSanitizeBreakthroughCore"),
  );
  assert("core route async job", route.includes("createXhighJob"));

  assert("bare ganzhi gloss user-facing", !BARE_GANZHI_MARKER.gloss.zh.includes("底层数据"));
  assert("bare ganzhi gloss scenario", BARE_GANZHI_MARKER.gloss.zh.includes("时间气候"));

  assert("execution_edge aliases", shensha.includes('"execution_edge"') && /羊刃/.test(shensha));
  assert("disruption_friction aliases", shensha.includes('"disruption_friction"') && shensha.includes('"劫煞"'));

  assert("羊刃 shensha id", toShenshaId("羊刃") === "execution_edge");
  assert("劫煞 shensha id", toShenshaId("劫煞") === "disruption_friction");

  const markedYang = autoMarkBareTerms("命局见羊刃与正官并立。", "zh");
  assert("羊刃 auto-marked", markedYang.includes("⟦t:") && !/命局见羊刃/.test(markedYang));
  const markedJie = autoMarkBareTerms("流年逢劫煞冲动。", "zh");
  assert("劫煞 auto-marked", markedJie.includes("⟦t:") && !/逢劫煞/.test(markedJie));

  const agent = {
    breakthrough_core: makeTestBreakthroughCore({
      situation_conclusion: "你在关系里容易先退后守。",
      response:
        "我看了你的情况：你在关系里容易先退后守。关键在站位，不在再找一套说辞。我心里有几条路，但得先了解你几件事。",
      modern_action_frames: [
        {
          direction: "先稳住边界再谈合作",
          why_fits: "先守节奏再谈合作",
          structural_basis: "正官与羊刃并立",
          needs_validation: "对方愿意按你的节奏来",
        },
        {
          direction: "把经验沉淀成可交接的模块",
          why_fits: "适合系统化输出",
          structural_basis: "乙木日主需扎根",
          needs_validation: "有徒弟主动来问",
        },
      ],
    }),
    investigation_agenda: [
      { id: "a1", label: "你最想先动哪一步？", critical: true, status: "unexplored" },
    ],
  } as unknown as POJUAgentState;

  const body = formatSegment2ReplyForUser(agent.breakthrough_core, "zh");
  assert("dialogue body present", body.includes("我看了你的情况"));
  assert("no direction card", !body.includes("### 破局方向"));

  const reply = buildCollectingTransitionReplyFromCore(agent, "zh");
  assert("reply has dialogue", reply.includes("先退后守"));
  assert("reply does not dump frame direction as heading", !reply.includes("### 破局方向"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
