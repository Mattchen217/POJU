/**
 * Block 101 — Segment 2 payment-audit leak sanitize (大运/日柱/煞名/生克短语)
 *
 *   pnpm exec tsx scripts/test-poju-block101-segment2-payment-leak-sanitize.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  applyComplianceSanitize,
  auditPaymentLeakResiduals,
  sanitizePaymentAuditLeaks,
  stripMarkersForPrompt,
} from "@/lib/llm/sanitize/compliance-terms";
import { repairShenshaMarkerSoftLabels } from "@/lib/llm/sanitize/term-marking";
import {
  mapBreakthroughCorePayload,
  parseSanitizeBreakthroughCore,
  sanitizeBreakthroughCoreMapped,
} from "@/lib/llm/deepseek/breakthrough-core";
import { isCriticalDeliveryAuditFailure } from "@/lib/llm/services/delivery-audit-regen";
import { detectPaymentAuditLeakViolations } from "@/lib/llm/compliance/audit-output";

const ROOT = path.resolve(__dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, cond: unknown, detail?: string): void {
  if (!cond) {
    console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${label}`);
  }
}

function main() {
  console.log("\n========== POJU Block 101 · Segment2 payment leak sanitize ==========\n");

  const core = read("lib/llm/deepseek/breakthrough-core.ts");
  const compliance = read("lib/llm/sanitize/compliance-terms.ts");
  const marking = read("lib/llm/sanitize/term-marking.ts");
  const runner = read("lib/poju/xhigh-job-runner.ts");
  const auditOut = read("lib/llm/compliance/audit-output.ts");

  assert("prompt bans bare structure words", core.includes("合规硬要求（用户可见字段"));
  assert("prompt anchors with soft vernacular", core.includes("锚定 = 讲清那个结构的意思") || core.includes("【锚定 = 讲清"));
  assert("sanitizePaymentAuditLeaks exported", compliance.includes("export function sanitizePaymentAuditLeaks"));
  assert("structure soft replace includes 日柱", compliance.includes('["日柱"'));
  assert("wuxing clash replace present", compliance.includes("replaceWuxingClashPhrases"));
  assert("repairShenshaMarkerSoftLabels present", marking.includes("export function repairShenshaMarkerSoftLabels"));
  assert("runner uses parseSanitizeBreakthroughCore", runner.includes("parseSanitizeBreakthroughCore"));
  assert("audit-output payment leak detector", auditOut.includes("detectPaymentAuditLeakViolations"));

  const leaky =
    "大运火金相克，叠孤鸾煞；日柱压力大，流年也不稳。⟦t:shensha.孤鸾煞|孤鸾煞|情感孤立⟧";
  const scrubbed = sanitizePaymentAuditLeaks(leaky, "zh");
  const visible = stripMarkersForPrompt(scrubbed);
  assert("scrub removes 大运", !visible.includes("大运"), visible);
  assert("scrub removes 流年", !visible.includes("流年"), visible);
  assert("scrub removes 日柱", !visible.includes("日柱"), visible);
  assert("scrub removes 火金相克", !visible.includes("火金相克") && !visible.includes("相克"), visible);
  assert("scrub removes 孤鸾煞 from visible", !visible.includes("孤鸾煞"), visible);
  assert("scrub keeps vernacular tension", visible.includes("较劲") || visible.includes("阶段"), visible);

  const markerOnly = repairShenshaMarkerSoftLabels(
    "倾向⟦t:shensha.孤鸾煞|孤鸾煞|情感孤立⟧会先撤退",
    "zh",
  );
  assert(
    "Fix C soft slot not 孤鸾煞",
    !markerOnly.includes("|孤鸾煞|") && !markerOnly.includes("|孤鸾煞⟧"),
    markerOnly,
  );
  assert(
    "Fix C soft slot has gloss",
    markerOnly.includes("独立运作模式") || markerOnly.includes("⟦t:shensha_"),
    markerOnly,
  );

  const applied = applyComplianceSanitize(leaky, "zh");
  assert("applyComplianceSanitize mutates", applied.text !== leaky);
  assert(
    "after sanitize no payment residuals",
    auditPaymentLeakResiduals(applied.text, "zh").length === 0,
    JSON.stringify(auditPaymentLeakResiduals(applied.text, "zh")),
  );

  const mapped = mapBreakthroughCorePayload({
    relationship_conclusion: "大运火金相克，叠孤鸾煞。",
    breakthrough_directions: [
      {
        direction: "先稳住边界",
        structural_basis: "月柱与日柱张力叠加",
        timing: "当前流年宜守",
        what_would_confirm: "对方愿意谈边界",
      },
      {
        direction: "换通道发力",
        structural_basis: "羊刃锋芒过早",
        timing: "阶段气候转稳后再进",
        what_would_confirm: "有可验证的小胜",
      },
    ],
    investigation_agenda: [
      { id: "a1", label: "最近一次越界是什么", status: "unexplored", critical: true },
      { id: "a2", label: "他真正要的优先级", status: "unexplored", critical: true },
      { id: "a3", label: "你能承受的底线", status: "unexplored", critical: false },
    ],
    first_question: "要把边界稳住，你上次硬碰的火金相克场面是怎样的？",
  });
  const sanitized = sanitizeBreakthroughCoreMapped(mapped, "zh");
  const blob = [
    sanitized.breakthrough_core.relationship_conclusion,
    ...sanitized.breakthrough_core.breakthrough_directions.flatMap((d) => [
      d.structural_basis,
      d.timing,
    ]),
    sanitized.breakthrough_core.first_question ?? "",
  ].join("\n");
  assert("mapped sanitize clears structure leaks", !/(大运|流年|日柱|月柱|孤鸾煞|羊刃|相克)/.test(blob), blob);
  assert(
    "residuals empty after mapped sanitize",
    sanitized.violations.length === 0,
    JSON.stringify(sanitized.violations),
  );

  const residual = auditPaymentLeakResiduals("这里仍写孤鸾煞与火金相克", "zh");
  assert(
    "residuals detected before sanitize",
    residual.some((v) => v.label.includes("孤鸾煞")) &&
      residual.some((v) => v.label.includes("wuxing")),
    JSON.stringify(residual),
  );
  assert("residuals are critical", isCriticalDeliveryAuditFailure(residual));

  const policyHits = detectPaymentAuditLeakViolations("大运火金相克叠孤鸾煞", "zh");
  assert("audit-output detector hits structure/clash/shensha", policyHits.length >= 1, JSON.stringify(policyHits));

  // Clean JSON path should succeed
  const cleanJson = JSON.stringify({
    relationship_conclusion: "你这段时期里，内在冲劲和外部约束正较着劲。",
    breakthrough_directions: [
      {
        direction: "先稳住边界",
        structural_basis: "执行锋芒与规则感并立，先守节奏",
        timing: "阶段气候转稳后再进",
        what_would_confirm: "对方愿意按你的节奏来",
      },
      {
        direction: "换通道发力",
        structural_basis: "表达力过旺时改用更克制的方式",
        timing: "有小胜再加码",
        what_would_confirm: "连续两周边界未被反复踩",
      },
    ],
    investigation_agenda: [
      { id: "a1", label: "最近一次越界是什么", status: "unexplored", critical: true },
      { id: "a2", label: "他真正要的优先级", status: "unexplored", critical: true },
      { id: "a3", label: "你能承受的底线", status: "unexplored", critical: false },
    ],
    first_question: "要把边界稳住，我想先知道最近一次对方越线时你有没有当场说清楚？",
  });
  const ok = parseSanitizeBreakthroughCore(cleanJson, "zh");
  assert("clean parseSanitize succeeds", !!ok.breakthrough_core.relationship_conclusion);

  if (process.exitCode) {
    console.error("\nSome Block 101 checks failed.");
    process.exit(1);
  }
  console.log("\nAll Block 101 checks passed.\n");
}

main();
