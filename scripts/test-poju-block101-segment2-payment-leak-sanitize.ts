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

  assert(
    "prompt bans bare structure words",
    core.includes("合规（用户可见字段") || core.includes("合规硬要求（用户可见字段"),
  );
  assert(
    "prompt anchors with soft vernacular",
    core.includes("锚定=讲清意思") ||
      core.includes("锚定 = 讲清那个结构的意思") ||
      core.includes("【锚定 = 讲清") ||
      core.includes("【锚定=讲清"),
  );
  assert("phrase stack replace present", compliance.includes("replaceZhMingliStacks"));
  assert("plain leak strip present", marking.includes("stripLeakedMarkerPlainFromBody"));
  assert("chained soft detect present", compliance.includes("hasChainedSoftReplaceArtifacts"));
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

  const stackIn = "找到支撑时，月柱正印壬水也需要木来转化。";
  const stackOut = sanitizePaymentAuditLeaks(stackIn, "zh");
  const stackVis = stripMarkersForPrompt(stackOut);
  assert("stack not 能量结构稳定支持力", !/能量结构稳定支持力/.test(stackVis), stackVis);
  assert("stack not 稳定支持力壬水", !/稳定支持力壬水/.test(stackVis), stackVis);
  assert("stack uses whole phrase soft", stackVis.includes("你内在那一股关键的支撑力"), stackVis);
  assert(
    "no chained soft residual",
    !auditPaymentLeakResiduals(stackOut, "zh").some((v) => v.label.includes("chained")),
    JSON.stringify(auditPaymentLeakResiduals(stackOut, "zh")),
  );

  const plainLeak =
    "木是⟦t:favorable_element|有利特质|木像你说的路径依赖那样托住你，比单打独斗有效十倍⟧比单打独斗有效十倍，你先停一下。";
  const plainOut = sanitizePaymentAuditLeaks(plainLeak, "zh");
  const plainVis = stripMarkersForPrompt(plainOut);
  assert(
    "plain does not duplicate into body",
    (plainVis.match(/比单打独斗有效十倍/g) ?? []).length <= 1,
    plainVis,
  );

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
    key_crossroads: {
      real_fork: "先守边界还是先换通道",
      path_costs: "硬碰耗神",
      decision_traits: "执行快但易过冲",
      structural_basis: "张力叠加",
      needs_validation: "最近一次越界",
    },
    energy_retune_frame: {
      direction_fit: "能量往稳根基使力",
      timing_ripeness: "阶段气候转稳后再进",
      daily_retune: "固定恢复节律",
      complementary: "靠近能落地的人",
      structural_basis: "用神喜静",
      needs_validation: "日常恢复方式",
      status: "hypothesis",
    },
    rhythm_frame: {
      phase1_observe: "观察触发条件",
      phase2_adjust: "小步调整边界",
      phase3_consolidate: "巩固已验证方向",
    },
    self_check_signals: ["能连续两周不靠硬扛", "一谈推进就失眠", "外部反馈从催促变成协作"],
    investigation_agenda: [
      { id: "a1", label: "最近一次越界是什么", status: "unexplored", critical: true },
      { id: "a2", label: "他真正要的优先级", status: "unexplored", critical: true },
      { id: "a3", label: "你能承受的底线", status: "unexplored", critical: false },
    ],
    first_question: "要把边界稳住，你上次硬碰的火金相克场面是怎样的？",
  });
  const sanitized = sanitizeBreakthroughCoreMapped(mapped, "zh");
  const blob = [
    sanitized.breakthrough_core.situation_conclusion,
    ...sanitized.breakthrough_core.modern_action_frames.flatMap((d) => [d.structural_basis, d.why_fits]),
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
    situation_conclusion: "你这段时期里，内在冲劲和外部约束正较着劲。",
    modern_action_frames: [
      {
        direction: "先稳住边界",
        why_fits: "先守节奏再谈合作",
        structural_basis: "执行锋芒与规则感并立，先守节奏",
        needs_validation: "对方愿意按你的节奏来",
      },
      {
        direction: "换通道发力",
        why_fits: "表达力过旺时改用更克制的方式",
        structural_basis: "表达力过旺时改用更克制的方式",
        needs_validation: "连续两周边界未被反复踩",
      },
    ],
    key_crossroads: {
      real_fork: "先守边界还是先换通道",
      path_costs: "硬碰耗神",
      decision_traits: "执行快但易过冲",
      structural_basis: "张力叠加",
      needs_validation: "最近一次越界",
    },
    energy_retune_frame: {
      direction_fit: "能量往稳根基使力",
      timing_ripeness: "阶段气候转稳后再进",
      daily_retune: "固定恢复节律",
      complementary: "靠近能落地的人",
      structural_basis: "用神喜静",
      needs_validation: "日常恢复方式",
      status: "hypothesis",
    },
    rhythm_frame: {
      phase1_observe: "观察触发条件",
      phase2_adjust: "小步调整边界",
      phase3_consolidate: "巩固已验证方向",
    },
    self_check_signals: ["能连续两周不靠硬扛", "一谈推进就失眠", "外部反馈从催促变成协作"],
    investigation_agenda: [
      { id: "a1", label: "最近一次越界是什么", status: "unexplored", critical: true },
      { id: "a2", label: "他真正要的优先级", status: "unexplored", critical: true },
      { id: "a3", label: "你能承受的底线", status: "unexplored", critical: false },
    ],
    first_question: "要把边界稳住，我想先知道最近一次对方越线时你有没有当场说清楚？",
  });
  const ok = parseSanitizeBreakthroughCore(cleanJson, "zh");
  assert("clean parseSanitize succeeds", !!ok.breakthrough_core.situation_conclusion);

  if (process.exitCode) {
    console.error("\nSome Block 101 checks failed.");
    process.exit(1);
  }
  console.log("\nAll Block 101 checks passed.\n");
}

main();
