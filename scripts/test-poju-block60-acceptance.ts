/**
 * Block 60 — 产议程补喂真实关系 + 四产品风格/闭集统一
 *
 *   pnpm exec tsx scripts/test-poju-block60-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildBreakthroughCorePrompt } from "@/lib/llm/deepseek/breakthrough-core";
import { POJU_V6_DIRECTED_RELATION_PHASES } from "@/lib/llm/phases/oriental-prompt-context-v6";
import {
  buildMatrixNarrativeRelationAppendix,
  getMatrixNarrativeSystemPrompt,
} from "@/lib/llm/prompts/matrix-narrative-prompt";
import { READING_LAYOUT_CONTRACT } from "@/lib/llm/prompts/reading-layout";
import { resolveAgendaRelationContext } from "@/lib/llm/prompts/relation-closed-set-context";
import { buildChatFactGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";

const ROOT = path.join(__dirname, "..");

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function makeStructured(four: {
  year: string;
  month: string;
  day: string;
  hour: string;
}): ProfileStructured {
  const pillar = (gz: string) => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god: "七杀",
    hidden_stems: [] as string[],
    shen_sha: ["华盖"] as string[],
  });
  return {
    day_master: four.day.charAt(0),
    pattern: "偏印格",
    yong_shen: "水",
    xi_shen: ["金"],
    ji_shen: ["火"],
    strength: "weak",
    four_pillars: four,
    pillars_detail: {
      year: pillar(four.year),
      month: pillar(four.month),
      day: pillar(four.day),
      hour: pillar(four.hour),
    },
    da_yun: [{ ganzhi: "癸酉", start_age: 3, start_year: 1993 }],
    data_availability: { pillars_detail: true, da_yun: true, bazi_enrichment: true },
  };
}

console.log("\n=== Block 60 acceptance ===\n");

// Part 1 — breakthrough-core uses unified guard + directed inventory
const coreTs = read("lib/llm/deepseek/breakthrough-core.ts");
const coreRoute = read("app/api/poju/breakthrough-core/route.ts");
assert("breakthrough-core imports buildChatFactGuardBlock", coreTs.includes("buildChatFactGuardBlock"));
assert("breakthrough-core no longer uses bare buildFactGuardBlock", !coreTs.includes("buildFactGuardBlock("));
assert("breakthrough-core injects directedInventoryBlock", coreTs.includes("directedInventoryBlock"));
assert("breakthrough-core returns auditRelations", coreTs.includes("auditRelations"));
assert("breakthrough-core route passes relations to circuit breaker", coreRoute.includes("opts: { relations: auditRelations }"));

const structured = makeStructured({ year: "丙寅", month: "辛巳", day: "甲寅", hour: "丙寅" });
const base_analysis = { structured, display_text: "neutral base" };
const { user, system, auditRelations } = buildBreakthroughCorePrompt({
  base_analysis,
  agent_v2: {
    current_phase: "collecting_context",
    original_question: "该不该跳槽",
    question_category: "career",
    context_collected: {},
    investigation_agenda: [],
  } as never,
  original_question: "该不该跳槽",
  locale: "zh",
});
assert("core user prompt includes 流年/定向动态关系 guard", user.includes("流年/定向动态关系"));
assert("core system includes directed inventory block", system.includes("流年") || system.includes("定向"));
assert("auditRelations non-empty for 寅巳 chart", auditRelations.length > 0, String(auditRelations.length));

const guard = buildChatFactGuardBlock(structured, {
  directedRelations: resolveAgendaRelationContext(structured, "career").directedDynamic,
  verbose: true,
});
assert("verbose guard includes 生成前再读一遍", guard.includes("生成前再读一遍"));

// Opening in directed relation phases
assert("opening in POJU_V6_DIRECTED_RELATION_PHASES", POJU_V6_DIRECTED_RELATION_PHASES.has("opening"));

const v6Ctx = read("lib/llm/phases/oriental-prompt-context-v6.ts");
assert("v6 infers question category from original_question", v6Ctx.includes("inferQuestionCategoryFromText"));

const openingV6 = read("lib/llm/phases/opening-phase-v6.ts");
assert("opening-phase-v6 passes audit_relations", openingV6.includes("audit_relations: auditRelations"));

// Part 2 — shared layout contract
assert(
  "READING_LAYOUT_CONTRACT includes computed fact discipline",
  READING_LAYOUT_CONTRACT.includes("本地计算事实"),
);
assert("match-base references READING_LAYOUT via buildMatchCorePromptSections", read("lib/llm/prompts/match-base.ts").includes("READING_LAYOUT_CONTRACT"));

// Part 3 — matrix / glyph / match wiring
assert(
  "matrix-narrative system includes READING_LAYOUT for syncro",
  getMatrixNarrativeSystemPrompt("syncro").includes("本地计算事实"),
);
const matrixPayload = {
  structured,
  wuxing_scores: [],
  strength: "balanced" as const,
  day_master_en: "Wood",
  matrix_id: "PJ-TEST",
  profile_id: "test",
  user_profile: { birth: { year: 1990, month: 1, day: 1, gender: "M", timezone: "UTC" }, bazi: structured.four_pillars, diagnosis: { dayMaster: "甲", favorableElements: [], challengingElements: [], patternSummary: "" } },
};
const syncroAppendix = buildMatrixNarrativeRelationAppendix(matrixPayload as never, "syncro");
assert("syncro matrix appendix includes 实例闭集", syncroAppendix.includes("structured 实例闭集"));
assert("syncro matrix appendix includes fact guard", syncroAppendix.includes("硬约束"));

const glyphBase = read("lib/llm/prompts/glyph-guanyin-base.ts");
assert("glyph-guanyin-base documents relation closed-set discipline", glyphBase.includes("2.1.1"));

console.log("\nDone.\n");
