/**
 * 指令 8 · base_analysis 本命关系锚定验收
 *
 *   pnpm exec tsx scripts/test-base-analysis-natal-relations.ts
 */
import { createHash } from "node:crypto";

import { auditBaseAnalysisDelivery } from "@/lib/base-analysis/delivery-gate";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  computeLiunianRelations,
  computeNatalChartRelations,
  getCurrentLiunian,
} from "@/lib/calculations/relation-engine";
import { RELATION_KIND_SOFT } from "@/lib/glossary/term-closed-set";
import { buildBaseAnalysisStreamPrompt } from "@/lib/llm/prompts/base-analysis-stream-prompt";
import { encodeTermMarker, plainByTermId } from "@/lib/llm/sanitize/compliance-terms";

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function makeProfile(four: {
  year: string;
  month: string;
  day: string;
  hour: string;
}): ProfileStructured {
  const pillar = (gz: string) => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god: "",
    hidden_stems: [] as string[],
    shen_sha: [] as string[],
  });
  return {
    day_master: four.day.charAt(0),
    pattern: "",
    yong_shen: "",
    xi_shen: [],
    ji_shen: [],
    strength: "balanced",
    four_pillars: four,
    pillars_detail: {
      year: pillar(four.year),
      month: pillar(four.month),
      day: pillar(four.day),
      hour: pillar(four.hour),
    },
    da_yun: [],
    data_availability: {
      pillars_detail: true,
      da_yun: false,
      bazi_enrichment: false,
    },
  };
}

console.log("\n=== base_analysis natal relation anchoring (指令 8) ===\n");

const chartWithRel = makeProfile({
  year: "甲子",
  month: "丙午",
  day: "戊辰",
  hour: "甲寅",
});
const chartEmptyRel = makeProfile({
  year: "癸酉",
  month: "辛酉",
  day: "丁酉",
  hour: "辛酉",
});

const natalRels = computeNatalChartRelations(chartWithRel);
assert("natal relations computed", natalRels.length > 0);
assert("all natal source", natalRels.every((r) => r.source === "natal"));

const liunian = getCurrentLiunian();
const liunianRels = computeLiunianRelations(chartWithRel, liunian);
assert(
  "liunian relations exist separately (not in natal set)",
  liunianRels.length > 0 && !natalRels.some((r) => r.id.startsWith("liunian_")),
);

const baseInventory = buildStructuredInstanceInventory(chartWithRel, { forBaseAnalysis: true });
assert("base inventory labels 本命结构关系", baseInventory.includes("本命结构关系"));
assert("base inventory lists 子午相冲", baseInventory.includes("子午相冲"));
assert("base inventory ignores liunian note", baseInventory.includes("忽略流年引动"));
assert(
  "downstream inventory keeps 本盘动态关系 label",
  buildStructuredInstanceInventory(chartWithRel).includes("本盘动态关系"),
);

const emptyInventory = buildStructuredInstanceInventory(chartEmptyRel, { forBaseAnalysis: true });
const emptyRels = computeNatalChartRelations(chartEmptyRel);
if (emptyRels.length === 0) {
  assert(
    "empty natal inventory forbids relation words",
    emptyInventory.includes("未算出本命关系"),
  );
} else {
  console.log(`  [INFO] empty-rel fixture still has ${emptyRels.length} natal relations — skip empty-template assert`);
}

const localData = { structured: chartWithRel, output_language: "zh" as const };
const promptA = buildBaseAnalysisStreamPrompt({ local_data: localData });
const promptB = buildBaseAnalysisStreamPrompt({ local_data: localData });

assert("prompt has anchoring block", promptA.system.includes("用本盘动态关系锚定结构"));
assert("prompt says natal only", promptA.system.includes("source=natal"));
assert("prompt says max one mention", promptA.system.includes("最多点一处"));
assert("prompt binding rule 14", promptA.system.includes("本命结构关系 · 锚定不枚举"));

const hashA = createHash("sha256").update(promptA.system, "utf8").digest("hex");
const hashB = createHash("sha256").update(promptB.system, "utf8").digest("hex");
assert("same profile → stable system bytes", hashA === hashB, hashA.slice(0, 16));

const chong = natalRels.find((r) => r.id === "chong_午_子") ?? natalRels[0]!;
const allowedMarker = encodeTermMarker(
  chong.id,
  RELATION_KIND_SOFT.chong.zh,
  plainByTermId(chong.id, "zh") ?? chong.han,
);
const allowedText = `## 系统脆弱点\n\n**结构张力:** 配置里${allowedMarker}让决策口径变窄——需要外部节律补位。`;
const allowedGate = auditBaseAnalysisDelivery(allowedText, "zh", chartWithRel);
assert("allowed natal relation passes gate", allowedGate.ok);

const inventedText = "## 系统脆弱点\n\n命盘里寅巳相刑需要经营。";
const inventedGate = auditBaseAnalysisDelivery(inventedText, "zh", chartWithRel);
assert(
  "invented relation blocked",
  inventedGate.violations.some((v) => v.label.startsWith("relation_")),
);

const liunianMarker = liunianRels[0]
  ? encodeTermMarker(
      liunianRels[0].id,
      RELATION_KIND_SOFT.chong.zh,
      plainByTermId(liunianRels[0].id, "zh") ?? liunianRels[0].han,
    )
  : "";
if (liunianMarker) {
  const liunianText = `## 核心底色\n\n今年${liunianMarker}引动系统。`;
  const liunianGate = auditBaseAnalysisDelivery(liunianText, "zh", chartWithRel);
  assert(
    "liunian relation marker blocked in base_analysis gate",
    liunianGate.violations.some((v) => v.label.startsWith("relation_")),
  );
}

console.log(
  process.exitCode === 1
    ? "\nSome base_analysis natal relation checks failed.\n"
    : "\nAll base_analysis natal relation checks passed.\n",
);
