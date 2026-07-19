/**
 * Block 66 — 根治聊天复读：定向 focusHints + 已锚定事实排除（user 侧）
 *
 *   pnpm exec tsx scripts/test-poju-block66-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  buildDirectedDynamicRelationInventoryBlock,
  computeDirectedDynamicRelations,
  getCurrentLiunian,
} from "@/lib/calculations/relation-engine";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  buildAnchoredFactsExclusionBlock,
  extractAnchoredFactIdsFromAssistant,
  mergeAnchoredFactIds,
} from "@/lib/poju/anchored-fact-tracking";
import {
  buildUsedMetaphorsAvoidBlock,
  extractUsedMetaphorsFromAssistant,
  mergeUsedMetaphors,
} from "@/lib/poju/reply-metaphor-extract";
import { extractRelationFocusHintsFromText } from "@/lib/poju/relation-focus-hints";
import {
  buildPojuSystemPromptV6,
  POJU_V6_METAPHOR_DISCIPLINE,
  POJU_V6_STATIC_SYSTEM,
  POJU_V6_TERM_SELECTION_DISCIPLINE,
} from "@/lib/llm/prompts/poju-base-v6";

const ROOT = path.join(__dirname, "..");

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function makeStructured(): ProfileStructured {
  const pillar = (gz: string, ten_god: string) => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god,
    hidden_stems: [] as string[],
    shen_sha: ["华盖"] as string[],
  });
  return {
    day_master: "甲",
    pattern: "偏印格",
    yong_shen: "水",
    xi_shen: ["金"],
    ji_shen: ["火"],
    strength: "weak",
    four_pillars: { year: "丙寅", month: "辛巳", day: "甲寅", hour: "丙寅" },
    pillars_detail: {
      year: pillar("丙寅", "食神"),
      month: pillar("辛巳", "正官"),
      day: pillar("甲寅", "比肩"),
      hour: pillar("丙寅", "食神"),
    },
    da_yun: [{ ganzhi: "癸酉", start_age: 3, start_year: 1993 }],
    data_availability: { pillars_detail: true, da_yun: true, bazi_enrichment: true },
  };
}

console.log("\n=== Block 66 acceptance ===\n");

const structured = makeStructured();
const liunian = getCurrentLiunian();
const wealthHints = extractRelationFocusHintsFromText("这几年没有收入，融资也拿不到");
const teamHints = extractRelationFocusHintsFromText("团队合伙人和员工怎么分工");
assert("wealth hints theme", wealthHints.themes.includes("wealth"));
assert("team hints theme", teamHints.themes.includes("team"));

const wealthRels = computeDirectedDynamicRelations(structured, liunian, "career", wealthHints);
const teamRels = computeDirectedDynamicRelations(structured, liunian, "career", teamHints);
const wealthBlock = buildDirectedDynamicRelationInventoryBlock(
  structured,
  liunian,
  "career",
  wealthHints,
);
const teamBlock = buildDirectedDynamicRelationInventoryBlock(structured, liunian, "career", teamHints);
assert("directed block shows focus=wealth", wealthBlock.includes("focus=wealth"));
assert("directed block shows focus=team", teamBlock.includes("focus=team"));
const wealthIds = wealthRels.map((r) => r.id).join(",");
const teamIds = teamRels.map((r) => r.id).join(",");
assert(
  "different user input → different directed slice (when pool allows)",
  wealthIds !== teamIds || wealthBlock !== teamBlock,
  `wealth=${wealthIds} team=${teamIds}`,
);

const v6Ctx = read("lib/llm/phases/oriental-prompt-context-v6.ts");
assert("v6 uses extractRelationFocusHintsFromText", v6Ctx.includes("extractRelationFocusHintsFromText"));
assert("v6 passes focusHints to inventory block", v6Ctx.includes("focusHints"));
assert("v6 uses buildAnchoredFactsExclusionBlock", v6Ctx.includes("buildAnchoredFactsExclusionBlock"));
assert("v6 uses buildUsedMetaphorsAvoidBlock", v6Ctx.includes("buildUsedMetaphorsAvoidBlock"));
assert("v6 audit uses full directed pool", v6Ctx.includes("directedDynamicRelsFull"));

const agentTs = read("lib/poju/agent.ts");
const agentStateTs = read("lib/poju/agent-state.ts");
assert("agent_state has anchored_fact_ids", agentStateTs.includes("anchored_fact_ids"));
assert("agent_state has used_metaphors", agentStateTs.includes("used_metaphors"));
assert("agent merges anchored facts after reply", agentTs.includes("extractAnchoredFactIdsFromAssistant"));
assert("agent merges used metaphors after reply", agentTs.includes("extractUsedMetaphorsFromAssistant"));

const ids = extractAnchoredFactIdsFromAssistant(
  "你的 ⟦t:day_master|本元|像藤蔓式扩散⟧ 和 ⟦t:yong_shen|锚元|需要冷却窗口⟧ 在这里很关键。",
);
assert("extracts term marker ids", ids.includes("day_master") && ids.includes("yong_shen"));
const merged = mergeAnchoredFactIds(["day_master"], ["yong_shen", "day_master"]);
assert("merge dedupes", merged.length === 2 && merged[0] === "day_master");

const anchoredBlock = buildAnchoredFactsExclusionBlock(["day_master", "yong_shen"], "zh");
assert("anchored block 勿复述", anchoredBlock.includes("勿复述"));
assert("anchored block lists labels", anchoredBlock.includes("本元"));

const metaphorReply =
  "你的优势像藤蔓一样扩散，但需要外部支点；内心有个冷却模块在空转，像打卡领通行证。";
const metaphors = extractUsedMetaphorsFromAssistant(metaphorReply);
assert("extracts curated metaphors", metaphors.includes("藤蔓") && metaphors.includes("冷却模块"));
assert("extracts external anchor phrases", metaphors.includes("外部支点"));
assert("extracts 像…一样 simile core", metaphors.includes("藤蔓"));
const metaphorMerged = mergeUsedMetaphors(["藤蔓"], ["冷却模块", "藤蔓"]);
assert("metaphor merge dedupes", metaphorMerged.length === 2 && metaphorMerged[0] === "藤蔓");
const avoidBlock = buildUsedMetaphorsAvoidBlock(["藤蔓", "冷却模块", "外部支点"], "zh");
assert("avoid block 勿再用", avoidBlock.includes("勿再用") && avoidBlock.includes("藤蔓"));
assert("avoid block 直接说本质", avoidBlock.includes("直接说本质"));

assert(
  "selection discipline in user control plane",
  read("lib/llm/prompts/poju-base-v6.ts").includes("POJU_V6_TERM_SELECTION_DISCIPLINE"),
);
assert("metaphor discipline in user control plane", read("lib/llm/prompts/poju-base-v6.ts").includes("POJU_V6_METAPHOR_DISCIPLINE"));
assert("discipline mentions 轮换", POJU_V6_TERM_SELECTION_DISCIPLINE.includes("轮换"));
assert("metaphor discipline 直接说本质", POJU_V6_METAPHOR_DISCIPLINE.includes("直接说本质"));
assert("metaphor discipline NOT in static system", !POJU_V6_STATIC_SYSTEM.includes("Insight Memory"));
assert("used metaphors block NOT in static system", !POJU_V6_STATIC_SYSTEM.includes("已用过的比喻"));

const systemNow = buildPojuSystemPromptV6();
assert("system === POJU_V6_STATIC_SYSTEM", systemNow === POJU_V6_STATIC_SYSTEM);
assert("selection discipline NOT in static system", !POJU_V6_STATIC_SYSTEM.includes("Block 61"));
assert("anchored block NOT in static system", !POJU_V6_STATIC_SYSTEM.includes("已锚定命理事实"));

const staticHash = createHash("sha256").update(POJU_V6_STATIC_SYSTEM, "utf8").digest("hex");
console.log("\n  POJU_V6_STATIC_SYSTEM SHA256:", staticHash);

console.log("\nDone.\n");
