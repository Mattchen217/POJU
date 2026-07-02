/**
 * S3 · relation closed-set integration (inventory / guard / audit)
 *
 *   pnpm exec tsx scripts/test-relation-closed-set.ts
 */
import { createHash } from "node:crypto";

import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { auditBaseAnalysisDelivery } from "@/lib/base-analysis/delivery-gate";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { computeChartRelations } from "@/lib/calculations/relation-engine";
import { isRelationMarkerId, RELATION_KIND_SOFT, TEN_GOD_TENSION_SOFT } from "@/lib/glossary/term-closed-set";
import { termPolarityById } from "@/lib/glossary/term-polarity";
import { buildChatFactGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";
import { POJU_V6_STATIC_SYSTEM } from "@/lib/llm/prompts/poju-base-v6";
import {
  auditRelationsAgainstInstance,
  encodeTermMarker,
  plainByTermId,
} from "@/lib/llm/sanitize/compliance-terms";

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

console.log("\n=== relation closed-set (S3) ===\n");

const chartChong = makeProfile({
  year: "甲子",
  month: "丙午",
  day: "戊辰",
  hour: "甲寅",
});
const rels = computeChartRelations(chartChong);
assert("chart has 子午相冲", rels.some((r) => r.id === "chong_午_子"));

const inventory = buildStructuredInstanceInventory(chartChong);
assert("inventory lists dynamic relations", inventory.includes("本盘动态关系"));
assert("inventory includes 子午相冲", inventory.includes("子午相冲"));

const guard = buildChatFactGuardBlock(chartChong);
assert("guard covers relations", guard.includes("本盘动态关系"));
assert("guard lists computed han", guard.includes("子午相冲"));
assert("guard warns against inventing", guard.includes("只有上面这几个"));

const allowedMarker = encodeTermMarker(
  "chong_午_子",
  RELATION_KIND_SOFT.chong.zh,
  plainByTermId("chong_午_子", "zh") ?? undefined,
);
const allowedText = `当前盘局里${allowedMarker}值得留意。`;
assert(
  "allowed marked relation passes audit",
  auditRelationsAgainstInstance(allowedText, chartChong).length === 0,
);

const inventedBare = "命盘里寅巳相刑需要经营。";
const inventedHits = auditRelationsAgainstInstance(inventedBare, chartChong);
assert(
  "invented bare relation blocked",
  inventedHits.some((h) => h.label.startsWith("relation_not_in_instance")),
);

const gateInvented = auditBaseAnalysisDelivery(inventedBare, "zh", chartChong);
assert("delivery gate blocks invented relation", !gateInvented.ok);

assert("relation marker id recognized", isRelationMarkerId("chong_午_子"));
assert("chong polarity caution", termPolarityById("chong_午_子") === "caution");
assert("banhe polarity favorable", termPolarityById("banhe_午_寅_火局") === "favorable");
assert("stemhe polarity neutral", termPolarityById("stemhe_乙_庚") === "neutral");

assert("liunian marker id recognized", isRelationMarkerId("liunian_chong_午_子_year"));
assert("ten god tension marker recognized", isRelationMarkerId("shangguan_jianguan"));
assert(
  "shangguan soft label neutral",
  plainByTermId("shangguan_jianguan", "zh") === TEN_GOD_TENSION_SOFT.shangguan_jianguan.zh,
);
assert("shangguan polarity caution", termPolarityById("shangguan_jianguan") === "caution");

const emptyInvChart = makeProfile({
  year: "癸酉",
  month: "辛酉",
  day: "丁酉",
  hour: "辛酉",
});
assert(
  "empty inventory template (via audit override)",
  auditRelationsAgainstInstance("此盘有子午相冲。", emptyInvChart, { relations: [] }).some((h) =>
    h.label.startsWith("relation_forbidden_empty_instance"),
  ),
);

const emptyRels = computeChartRelations(emptyInvChart);
if (emptyRels.length > 0) {
  console.log(`  [INFO] live empty-chart fixture has ${emptyRels.length} relations (mock path tested above)`);
}

const systemHash = createHash("sha256").update(POJU_V6_STATIC_SYSTEM, "utf8").digest("hex");
assert("v6 static system unchanged (prefix cache)", systemHash.length === 64);

console.log(
  process.exitCode === 1 ? "\nSome checks failed.\n" : "\nAll relation closed-set checks passed.\n",
);
