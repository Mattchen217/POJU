/**
 * 底座 · 全量冒烟（一条命令验证整批是否落全）
 *   pnpm exec tsx scripts/test-base-analysis-full.ts
 *
 * 存在理由：补丁被拆成多份 patch 时，Cursor 会漏落其中几条（2026-07-18 就漏了 4 条）。
 * 这个脚本把散落的守卫全串起来，一眼看出"哪条没落"。
 */
import fs from "node:fs";
import path from "node:path";
import {
  wrapBareWuxingInMingliContext,
  wrapBareTenGods,
  wrapBareStemElements,
} from "@/lib/llm/sanitize/term-marking";
import { applyComplianceSanitize } from "@/lib/llm/sanitize/compliance-terms";
import { auditEvidenceMarkDensity } from "@/lib/base-analysis/delivery-gate";
import { METAPHOR_BLACKLIST_ZH } from "@/lib/llm/compliance/banned-terms";

const failures: string[] = [];
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const assert = (l: string, ok: boolean) => {
  if (!ok) failures.push(l);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${l}`);
};

function main(): void {
  console.log("\n===== 底座 · 全量冒烟 =====\n");

  // ── 四类确定性打标器 ──
  console.log("[打标器]");
  assert(
    "天干：辛金→标记",
    wrapBareStemElements("核心特质辛金稳定。", "zh").includes("⟦t:stem_xin"),
  );
  const wx = wrapBareWuxingInMingliContext(
    "关键平衡能量是木，需留意为火与土。木主生长。",
    "zh",
  );
  assert("五行：是木→标记", wx.includes("⟦t:wood"));
  assert("五行：为火→标记", wx.includes("⟦t:fire"));
  for (const s of ["多去有树木水流的地方", "他有金钱观念", "水平不错", "别上火", "这片土地"]) {
    assert(
      `五行不误伤日常词：${s}`,
      !wrapBareWuxingInMingliContext(s, "zh").includes("⟦t:"),
    );
  }
  const tg = wrapBareTenGods("以食神换取偏财，正印生身。", "zh");
  assert("十神：食神→标记", tg.includes("⟦t:shi_shen"));
  assert("十神：偏财→标记", tg.includes("⟦t:pian_cai"));
  assert("十神：正印→标记", tg.includes("⟦t:zheng_yin"));

  // ── 端到端：清洗链全接上 ──
  console.log("\n[端到端 · applyComplianceSanitize / sanitizeDeliveryBodyPart 路径]");
  const leak = "正文。\n\n**依据与推理:** 你以食神换取偏财，关键平衡能量是木。";
  const cleaned = applyComplianceSanitize(leak, "zh").text;
  assert(
    "食神 被清洗链打标或消除",
    !cleaned.includes("食神") || cleaned.includes("⟦t:shi_shen"),
  );
  assert(
    "偏财 被清洗链打标或消除",
    !cleaned.includes("偏财") || cleaned.includes("⟦t:pian_cai"),
  );
  assert("换行没被吃（repair 能按行切）", cleaned.includes("\n"));

  // ── 金字下限闸 ──
  console.log("\n[金字下限闸]");
  assert(
    "2 个金字→判失败",
    auditEvidenceMarkDensity(
      "## A\n\n**依据与推理:** ⟦t:day_master|⟧ 与 ⟦t:fire|⟧。\n",
    ).some((v) => v.label.startsWith("evidence_marks_thin")),
  );
  assert(
    "3 个金字→放行",
    auditEvidenceMarkDensity(
      "## A\n\n**依据与推理:** ⟦t:day_master|⟧、⟦t:fire|⟧、⟦t:wood|⟧ 闭合。\n",
    ).length === 0,
  );
  assert(
    "下限闸接进 auditBaseAnalysisDelivery",
    read("lib/base-analysis/delivery-gate.ts").includes("auditEvidenceMarkDensity"),
  );

  // ── 黑名单空 ──
  console.log("\n[黑名单]");
  assert("比喻黑名单空", METAPHOR_BLACKLIST_ZH.length === 0);
  assert(
    "藤蔓不再违规",
    !applyComplianceSanitize("你像一株柔韧的藤蔓。", "zh").violationsAfter.some(
      (v) => v.label === "metaphor_blacklist",
    ),
  );

  // ── 提示词 ──
  console.log("\n[提示词]");
  const p = read("lib/llm/prompts/base-analysis-stream-prompt.ts");
  assert("依据先行", p.includes("依据先行"));
  assert(
    "锚点含神煞/关系",
    p.includes("至少 1 个必须是 shensha") || p.includes("至少 1 个必须来自 shensha"),
  );
  assert("删依据自检", p.includes("把依据块整个删掉"));
  // 源码是模板字符串转义 \`…\`，readFile 看到的是带反斜杠的形式
  assert("五行必打标", p.includes("⟦t:wood|⟧") && p.includes("不写「木」"));
  assert("十神必打标", p.includes("⟦t:shi_shen|⟧") && p.includes("不写「食神」"));
  assert("金字下限 3", p.includes("下限 3"));

  // ── core_judgments ──
  console.log("\n[core_judgments]");
  const cj = read("lib/base-analysis/generate-core-judgments.ts");
  assert(
    "rule7 含 balance_anchor",
    /structural_gap、leverage_state、balance_anchor/.test(cj),
  );
  assert("超时 180s", /180_000/.test(cj));
  assert("正例仍为 0", !cj.includes("正例"));

  // ── 底座渲染 ──
  console.log("\n[渲染]");
  assert(
    "底座开 dualLayer",
    /RichReadingText[\s\S]{0,120}dualLayer/.test(
      read("components/base-analysis/BaseAnalysisDeliveryView.tsx"),
    ),
  );

  // ── 接线守卫 ──
  console.log("\n[接线]");
  const ct = read("lib/llm/sanitize/compliance-terms.ts");
  assert("交付清洗接五行", ct.includes("wrapBareWuxingInMingliContext"));
  assert("交付清洗接十神", ct.includes("wrapBareTenGods"));
  const rp = read("lib/base-analysis/repair-violations.ts");
  assert(
    "密度不足拒 repair",
    rp.includes("repair_unrepaireable_evidence_density"),
  );

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 全部落全。"
        : `❌ ${failures.length} 条没落：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}
main();
