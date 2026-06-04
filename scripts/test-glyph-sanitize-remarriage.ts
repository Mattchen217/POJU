/**
 * Verify 再婚 case leaks (喜土金 / 贵人) are caught + masked.
 * Run: pnpm tsx scripts/test-glyph-sanitize-remarriage.ts
 */
import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";
import {
  auditGlyphReadingContent,
  detectGlyphOutputViolations,
  sanitizeGlyphOutput,
  sanitizeGlyphReadingContent,
} from "@/lib/glyph/sanitize-output";

/** Simulated leaky LLM output from「何时再婚」case (sign #4 玉莲会十朋). */
const leakyRemarriageReading: GlyphReadingContent = {
  wind_category_blurb: "Fair Sky 气势：关系议题有重新对齐的空间。",
  classical_voice:
    "这个原型隐喻映照出「破镜重圆」的系统性情境模式，适合反思关系修复。",
  命理双视角: {
    命理看此事:
      "你当前 10 年生命周期里，人格核心架构偏柔韧。命局喜土金，需要稳定感与结构判断。" +
      "今年流年里贵人显，外部助力可能增强。就「何时再婚」而言，你此刻的心理准备比时间点更重要。",
    签文看此事:
      "隐喻指向「失而复得」的叙事原型：分离后仍有重新整合的可能，但不宜断言时间表。",
    两者印证或冲突:
      "人格侧需要稳定与结构，隐喻侧强调修复——两者都指向当下的自我整合，而非预测何时发生。",
  },
  meaning_for_question:
    "关于再婚，这不是占卜时间表，而是【当下时机评估】：你是否已具备稳定感与边界感。" +
    "喜土金意味着你需要先补内在结构，贵人扶持出现时也要辨识是否匹配你的节奏。",
  hidden_tension: "你可能把「等待贵人」当成被动拖延，而忽略主动建立信任。",
  your_moment: "当前年度周期内，适合练习辨识外部助力与自我节奏是否一致。",
  exploration: {
    text: "今晚写下：什么样的支持感会让你愿意再次敞开？10 分钟。",
    timeframe: "tonight",
    duration_estimate: "10 minutes",
    is_solo: true,
  },
  reflection_question: "若不再问「何时」，而问「我准备好了吗」——你的答案是什么？",
};

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("✗", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

function main() {
  const samples = [
    "命局喜土金，贵人显",
    "喜用水金与忌火土并存",
    "贵人扶持来自同事",
    "五行偏金，需补水",
  ];

  console.log("=== detectGlyphOutputViolations (samples) ===");
  for (const s of samples) {
    const v = detectGlyphOutputViolations(s);
    assert(v.length > 0, `"${s}" → ${v.length} violation(s): ${v.map((x) => x.label).join(", ")}`);
  }

  console.log("\n=== 再婚 case audit (leaky) ===");
  const violations = auditGlyphReadingContent(leakyRemarriageReading);
  const labels = new Set(violations.map((v) => v.label));
  assert(violations.length > 0, `leaky reading has ${violations.length} violations`);
  assert(
    labels.has("wuxing_yongxi") ||
      labels.has("term:喜土金") ||
      violations.some((v) => v.snippet.includes("喜土金")),
    "catches 喜土金",
  );
  assert(
    labels.has("guiren") || violations.some((v) => v.snippet.includes("贵人")),
    "catches 贵人",
  );

  console.log("\n=== sanitize mask (再婚 case) ===");
  const sanitized = sanitizeGlyphReadingContent(leakyRemarriageReading, "zh");
  const merged = [
    sanitized.命理双视角.命理看此事,
    sanitized.meaning_for_question,
    sanitized.hidden_tension,
  ].join("\n");

  assert(!merged.includes("喜土金"), "sanitized: no 喜土金");
  assert(!merged.includes("贵人"), "sanitized: no 贵人");
  assert(
    merged.includes("稳定") || merged.includes("结构判断"),
    "sanitized: 喜土金 → compliance phrasing",
  );
  assert(merged.includes("外部"), "sanitized: 贵人 → 外部助力 phrasing");

  const reaudit = auditGlyphReadingContent(sanitized);
  console.log(`re-audit after sanitize: ${reaudit.length} remaining violation(s)`);
  if (reaudit.length > 0) {
    console.log(
      "remaining:",
      reaudit.slice(0, 5).map((v) => `${v.label}: ${v.snippet}`),
    );
  }

  console.log("\n=== spot sanitize ===");
  const spot = sanitizeGlyphOutput("喜土金与贵人显同时出现", "zh");
  assert(!spot.includes("喜土金") && !spot.includes("贵人"), `spot: "${spot}"`);

  if (process.exitCode) {
    console.error("\nSome checks failed.");
    process.exit(1);
  }
  console.log("\nAll remarriage sanitize checks passed.");
}

main();
