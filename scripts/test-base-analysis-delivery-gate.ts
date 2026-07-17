/**
 * base-analysis delivery gate — blocks out-of-set shen_sha, broken markers, etc.
 * Run: pnpm tsx scripts/test-base-analysis-delivery-gate.ts
 */
import { getBaziChart } from "shunshi-bazi-core";

import {
  auditBaseAnalysisDelivery,
  isBaseAnalysisGateFailure,
} from "@/lib/base-analysis/delivery-gate";
import { buildProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  auditMarkerCompleteness,
  auditOutOfSetTerms,
  auditShenShaAgainstInstance,
  encodeTermMarker,
} from "@/lib/llm/sanitize/compliance-terms";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo, UserProfile } from "@/lib/profile/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("✗", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

function buildStructured() {
  const birth: BirthInfo = {
    year: 1990,
    month: 3,
    day: 24,
    hour_period: "si",
    gender: "M",
    timezone: "Asia/Shanghai",
    birth_location: {
      name: "Guangzhou",
      longitude: 113.2644,
      latitude: 23.1291,
      timezone: "Asia/Shanghai",
      use_defaults: false,
    },
  };
  const params = shunshiParamsFromBirthInfo(birth);
  const chart = getBaziChart({ ...params, useTrueSolarTime: true, sect: 1 });
  const pillars = chart.八字?.柱位详细;
  const profile: UserProfile = {
    id: "gate_test",
    birth,
    bazi: {
      yearPillar: pillars?.年柱?.干支 ?? "?",
      monthPillar: pillars?.月柱?.干支 ?? "?",
      dayPillar: pillars?.日柱?.干支 ?? "?",
      hourPillar: pillars?.时柱?.干支 ?? "?",
    },
    diagnosis: {
      dayMaster: chart.八字?.日主 ?? "戊",
      favorableElements: ["水"],
      challengingElements: ["火"],
      patternSummary: "test",
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: "shunshi",
  };
  return buildProfileStructured({ profile, chart });
}

function main() {
  const structured = buildStructured();

  console.log("=== out-of-set shen_sha ===");
  const badShenSha = "命盘带元辰与六秀日，阴差阳错需留意。";
  assert(auditOutOfSetTerms(badShenSha).some((h) => h.snippet === "元辰"), "detects 元辰");
  assert(auditOutOfSetTerms(badShenSha).some((h) => h.snippet === "六秀日"), "detects 六秀日");
  assert(auditOutOfSetTerms(badShenSha).some((h) => h.snippet === "阴差阳错"), "detects 阴差阳错");

  const gateBad = auditBaseAnalysisDelivery(badShenSha, "zh", structured);
  assert(!gateBad.ok && isBaseAnalysisGateFailure(gateBad.violations), "gate blocks out-of-set");

  console.log("\n=== broken markers ===");
  const broken = `See ${encodeTermMarker("fei_ren", "double-edged drive", "")} and trailing ⟦t:day_master|core (乙木)`;
  assert(auditMarkerCompleteness(broken).some((h) => h.label === "broken_marker"), "broken marker");
  const gateBroken = auditBaseAnalysisDelivery(broken, "en", structured);
  assert(!gateBroken.ok, "gate blocks broken markers");

  console.log("\n=== missing plain + 2-slot standard + plain-slot bans ===");
  // Standard 2-slot ⟦t:slug|plain⟧ — must NOT be flagged as missing_plain
  assert(
    !auditMarkerCompleteness("⟦t:day_master|柔韧的吸收与转化者⟧").some(
      (h) => h.label === "marker_missing_plain",
    ),
    "2-slot standard form accepted (plain in slot2)",
  );
  assert(
    auditMarkerCompleteness("⟦t:day_master|乙木⟧", "zh").some((h) =>
      h.label.startsWith("marker_plain_banned"),
    ),
    "plain slot bare 乙木 blocked",
  );
  assert(
    auditMarkerCompleteness("⟦t:day_master|如盆景般需精准滋养的乙木⟧", "zh").some((h) =>
      h.label.startsWith("marker_plain_banned"),
    ),
    "plain slot 乙木 inside phrase blocked",
  );
  assert(
    auditMarkerCompleteness("⟦t:shi_shen|将感受化为产出的食神⟧", "zh").some(
      (h) => h.label === "marker_plain_banned:食神",
    ),
    "plain slot 食神 blocked",
  );
  assert(
    auditMarkerCompleteness("⟦t:zheng_yin|来自知识与长辈的供源正印⟧", "zh").some(
      (h) => h.label === "marker_plain_banned:正印",
    ),
    "plain slot 正印 blocked",
  );
  assert(
    !auditMarkerCompleteness("⟦t:day_master|如盆景般需精准滋养的柔韧生长力⟧", "zh").some((h) =>
      h.label.startsWith("marker_plain_banned"),
    ),
    "clean vernacular plain passes",
  );
  assert(
    !auditMarkerCompleteness("⟦t:yong_shen|润泽与滋养⟧").some((h) => h.label === "marker_missing_plain"),
    "2-slot yong_shen accepted",
  );
  // Truly empty plain only
  assert(
    auditMarkerCompleteness("Text ⟦t:fei_ren|⟧ end.").some((h) => h.label === "marker_missing_plain"),
    "empty plain segment still flagged",
  );
  // encodeTermMarker(id, visible) without plain seeds slot2 — valid 2-slot, not missing
  const twoSlotSeed = encodeTermMarker("fei_ren", "double-edged drive");
  assert(
    !auditMarkerCompleteness(`Text ${twoSlotSeed} end.`).some((h) => h.label === "marker_missing_plain"),
    "encodeTermMarker 2-slot seed is not missing_plain",
  );
  // marker_visible_* only on compat 3-slot (model-written soft)
  assert(
    !auditMarkerCompleteness("⟦t:stem_yi|乙木柔韧⟧").some((h) => h.label === "marker_visible_ganzhi"),
    "2-slot does not run marker_visible_ganzhi (slot2 is plain, soft is SSOT)",
  );
  assert(
    auditMarkerCompleteness("⟦t:stem_yi|乙木柔韧|plain⟧").some((h) => h.label === "marker_visible_ganzhi"),
    "3-slot compat still flags ganzhi in soft slot",
  );
  const badArticle = "⟦t:fei_ren|the the refined core|plain here⟧";
  assert(
    auditMarkerCompleteness(`X ${badArticle}`).some((h) => h.label === "marker_visible_article_dup"),
    "article dup in visible (3-slot only)",
  );

  console.log("\n=== instance shen_sha inventory ===");
  const emptyInvStructured = {
    ...structured,
    pillars_detail: structured.pillars_detail
      ? {
          year: { ...structured.pillars_detail.year, shen_sha: [] as string[] },
          month: { ...structured.pillars_detail.month, shen_sha: [] as string[] },
          day: { ...structured.pillars_detail.day, shen_sha: [] as string[] },
          hour: { ...structured.pillars_detail.hour, shen_sha: [] as string[] },
        }
      : undefined,
  };
  const invHits = auditShenShaAgainstInstance("配置含桃花", emptyInvStructured);
  assert(
    invHits.some((h) => h.label === "shen_sha_forbidden_empty_instance:桃花"),
    "empty instance inventory forbids any shen_sha name",
  );

  console.log("\n=== good marker passes ===");
  const good = `**Lead:** ${encodeTermMarker("fei_ren", "double-edged drive", "Channel edge into one cut")} stabilizes output.`;
  const gateOk = auditBaseAnalysisDelivery(good, "en", structured);
  assert(gateOk.ok || !isBaseAnalysisGateFailure(gateOk.violations), "clean marker passes gate");

  if (process.exitCode) process.exit(1);
  console.log("\nAll base-analysis delivery gate checks passed.");
}

main();
